# Plan — precomputed variants + public/private photo serving

**Supersedes the serving design in ADR 0004** (its token/revocation model survives; its
`/cdn-cgi/image/` serving layer does not). Read ADR 0004's Context section first for why.

**Recommended implementer: Opus.** The backend phases are mechanical given this plan, but the
work touches security-sensitive unauthenticated routes (phase 4) and design-language UI
(phase 7, must follow `docs/imgthing-ui.md`). If split, Sonnet can take phases 1–6 and Opus
phase 7.

## Summary of the design

- At upload, generate three fixed WebP variants of each photo with the Images binding and
  store them in R2 (`variants/{id}/{size}`). The binding is used **only** as an upload-time
  resize function — never on a per-view serving path.
- Serving (private and public) is: auth/token check → R2 get → stream. No `/cdn-cgi/image/`,
  no purge API, no custom-domain dependency.
- Variants are **self-healing**: any serving route that misses the variant object generates
  it from the original on the spot and persists it. This makes backfill of pre-existing
  photos automatic and upload-time generation failure non-fatal.
- Public access is by unguessable per-photo token, rotated on every publish. Unpublish =
  flag flip; the next request 404s (no edge-cache purge needed since nothing is edge-cached).
- EXIF never ships in public bytes. Public metadata (camera/lens/exposure/GPS) is served as
  JSON from a companion endpoint, with GPS gated behind a separate per-photo opt-in.

Work through phases in order; each ends with a green `npm run test:all` + `npm run typecheck`
+ `npm run check`. Commit per phase directly to main (repo convention).

---

## Phase 1 — Migration 0006

`server/db/migrations/0006_public_photos.sql`:

```sql
-- Public sharing + precomputed variants. visibility/public_token/published_at drive
-- the tokened public routes; show_location gates GPS in the public meta endpoint;
-- variants_generated_at records that the fixed R2 variants exist (NULL = pending,
-- the serving routes self-heal). SQLite can't ADD COLUMN with UNIQUE, hence the index.

ALTER TABLE photos ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE photos ADD COLUMN public_token TEXT;
ALTER TABLE photos ADD COLUMN published_at TEXT;
ALTER TABLE photos ADD COLUMN show_location INTEGER NOT NULL DEFAULT 0;
ALTER TABLE photos ADD COLUMN variants_generated_at TEXT;

CREATE UNIQUE INDEX idx_photos_public_token ON photos (public_token);
```

`visibility` values are `'private' | 'public'`, enforced in app code (no CHECK — keeps the
ALTER simple). The unique index tolerates many NULLs (SQLite semantics). Run
`npm run db:migrate:local`; the integration test pool applies migrations itself from
`migrations_dir`.

## Phase 2 — Variant utility (`server/utils/variants.ts`, new)

Move `SIZES` out of `server/api/photos/[id]/variant.get.ts` into here and export:

```ts
export const VARIANT_SIZES = { thumb: 800, md: 1280, lg: 2560 } as const;
export type VariantSize = keyof typeof VARIANT_SIZES;
export function isVariantSize(v: string | undefined): v is VariantSize;
export function variantKey(photoId: string, size: VariantSize): string; // `variants/${photoId}/${size}`
```

**Orientation change**: transforms switch from width-only to a longest-side bounding box —
`transform({ width: N, height: N, fit: "scale-down" })`, output
`{ format: "image/webp", quality: 88 }`. `scale-down` fits within N×N preserving aspect
ratio and never upscales, so portrait/landscape/square get equal pixel budgets. Preserve the
existing rationale comment from `variant.get.ts` (retina sizing) and extend it with the
longest-side reasoning. Check `worker-configuration.d.ts` for a `metadata` option on the
transform/output types; if present, set it to `"none"`. Either way, phase 8 asserts variant
bytes carry no EXIF.

Core functions (both take bindings as arguments, matching the `purgePhotos` style in
`server/utils/photos.ts`):

- `generateVariants(images, bucket, photoId, original: ArrayBuffer)` — for each size, run
  the transform (fresh `.input()` per size — the binding consumes its input stream; make a
  new `ReadableStream`/blob stream from the buffer each time) and `bucket.put(variantKey(...),
  bytes, { httpMetadata: { contentType: "image/webp" } })`. `result.image()` returns a
  ReadableStream — R2 `put` needs a known length, so buffer it (`new Response(stream).arrayBuffer()`).
  Originals are capped at 25 MB (upload limit), so three sequential buffered transforms are
  fine for Worker memory; do the sizes sequentially, not `Promise.all`.
- `getOrCreateVariant(db, images, bucket, photo: { id, r2_key }, size)` — `bucket.get`
  the variant key; on hit return the R2 object body. On miss (self-heal): get the original
  from R2 (404 if missing), run `generateVariants` for **all** sizes (a miss for one usually
  means all are missing; generating all avoids three separate heal round-trips), stamp
  `variants_generated_at = datetime('now')`, and return the requested size's bytes.

## Phase 3 — Upload generates variants

In `server/api/photos/index.post.ts`, after the D1 batch insert succeeds for a file, call
`generateVariants(...)` with the `bytes` buffer already in scope, then
`UPDATE photos SET variants_generated_at = datetime('now') WHERE id = ?`.

Wrap it in try/catch and **do not fail the upload** if generation throws — the photo row and
original are already durable, and serving self-heals. On failure, `console.error` and leave
`variants_generated_at` NULL. Keep per-file, inside the existing loop.

## Phase 4 — Rewrite private serving; add publish/unpublish + public routes

### 4a. `server/api/photos/[id]/variant.get.ts` (rewrite)

Keep the route shape (`?size=` validated against the allowlist, 400/404 behavior, session
auth via middleware). Body becomes: fetch `{ id, r2_key }` row → `getOrCreateVariant` →
stream with `content-type: image/webp` and the existing
`cache-control: private, max-age=31536000, immutable`. `raw.get.ts` is unchanged.

### 4b. Publish/unpublish (session-gated, under `/api`)

`server/api/photos/[id]/publish.post.ts`:
- 404 if the photo doesn't exist or is trashed (`deleted_at IS NOT NULL`).
- Body (optional): `{ showLocation?: boolean }`, default false.
- Generate a **fresh token every time** (rotation is the revocation primitive — a re-publish
  must mint a new URL): 16 bytes from `crypto.getRandomValues`, hex-encoded (32 chars,
  128 bits). Small helper `generatePublicToken()` in `server/utils/photos.ts`.
- `UPDATE photos SET visibility='public', public_token=?, published_at=datetime('now'),
  show_location=? WHERE id=?`.
- Return `{ token, urls: { thumb, md, lg, meta } }` built from the request origin
  (`getRequestURL(event).origin`).

`server/api/photos/[id]/unpublish.post.ts`:
- `UPDATE photos SET visibility='private', public_token=NULL, published_at=NULL WHERE id=?`
  (idempotent; 404 only if the photo doesn't exist). No purge step exists in this design.

### 4c. Public routes (new, **outside** `/api` so `server/middleware/auth.ts` skips them)

Nitro non-API routes live in `server/routes/`. The `/p/**` namespace has no page-route
collision (`app/middleware/auth.global.ts` only affects pages, not server routes).

`server/routes/p/[token]/[size].get.ts`:
1. Validate `size` with `isVariantSize` → 404 otherwise (uniform 404s everywhere on this
   route; never reveal whether a token exists, is private, or is trashed).
2. Cheap token shape guard before D1: `/^[0-9a-f]{32}$/` → 404.
3. `SELECT id, r2_key FROM photos WHERE public_token = ? AND visibility = 'public' AND
   deleted_at IS NULL` → 404 on miss.
4. `getOrCreateVariant` (self-heal applies here too — bounded cost: once per photo+size
   ever, then it's persisted) → stream with:
   - `content-type: image/webp`
   - `cache-control: public, max-age=3600` (browsers/proxies may hold copies for ≤1h after
     unpublish — the accepted revocation window; do not raise without reconsidering that)
   - `access-control-allow-origin: *`

`server/routes/p/[token]/meta.get.ts`:
- Same token guard + same D1 predicate, joined to `exif_data`; also select `show_location`,
  `original_filename`, `published_at`.
- Return JSON: `{ filename, takenAt, camera: { make, model }, lens, exposure, aperture,
  iso, focalLength, publishedAt, gps }` where `gps` is `{ latitude, longitude }` **only when
  `show_location = 1` and coordinates exist**, else `null`. Never include `id`, `r2_key`, or
  `other_data` (the raw EXIF blob may itself contain GPS/serials).
- Headers: `access-control-allow-origin: *`, `cache-control: public, max-age=300`.

## Phase 5 — Trash/delete interplay

- **Trash implies unpublish**: in the soft-delete handlers
  (`server/api/photos/[id]/index.delete.ts` and the bulk `server/api/photos/index.delete.ts`),
  the UPDATE that sets `deleted_at` also sets `visibility='private'`, `public_token=NULL`,
  `published_at=NULL`. Restoring from trash does **not** re-publish (deliberate: restore
  should never silently re-expose). The public routes' `deleted_at IS NULL` predicate is
  belt-and-suspenders on top.
- **Hard delete removes variants**: in `purgePhotos` (`server/utils/photos.ts`), extend the
  R2 `Promise.all` to also delete `variantKey(r.id, size)` for the three sizes (same
  `.catch(() => {})` tolerance).

## Phase 6 — Backfill

None needed: the self-heal path in `getOrCreateVariant` migrates existing photos on first
view, and there is no deployed production data yet anyway. Do not write a script.

## Phase 7 — UI (follow `docs/imgthing-ui.md` — Bright Studio Glass; shadcn/reka components)

- Extend the `Photo` interface (`app/components/PhotoViewer.vue:39`) and the list SELECT in
  `server/api/photos/index.get.ts` with `visibility`, `public_token`, `show_location`.
- **Share control in the PhotoViewer action bar**: a Share button opening a
  popover/dialog with:
  - a Public switch (calls publish/unpublish; on publish success, update local state with
    the returned token),
  - a "Show location" switch (visible only when the photo has GPS; toggling while public
    re-calls publish — note in the UI copy that this rotates the link — or add it to the
    publish body on next publish),
  - copy-to-clipboard rows for the md and lg public URLs (build as `${location.origin}/p/${token}/${size}`),
  - when already public, a subtle "links break if you unpublish or re-publish" hint.
- **Public indicator**: small badge/icon (e.g. globe) on grid tiles and in the viewer for
  `visibility === 'public'`, consistent with the existing favorite indicator treatment.
- Bulk actions: out of scope; publish is per-photo only.

## Phase 8 — Tests (extend `test/integration/`, reuse `helpers.ts` login/pngBytes)

New `test/integration/public.test.ts`:
1. publish requires auth (401 without cookie); publish returns a 32-hex token + urls.
2. `GET /p/{token}/md` succeeds **without** a session cookie, `content-type: image/webp`,
   `cache-control` contains `public`.
3. Uniform 404s: unknown token, valid-shape-but-wrong token, size outside the allowlist,
   token of a photo after unpublish, token of a trashed photo.
4. Rotation: publish → unpublish → publish again yields a different token, and the first
   token 404s.
5. Trash-implies-unpublish: publish, soft-delete, assert `/p/{old-token}/md` 404s and the
   photo row shows `public_token IS NULL` (assert via API responses, not raw D1).
6. Meta endpoint: GPS absent by default, present with `showLocation: true`; no `r2_key`/`id`
   keys in the JSON; works without auth; 404 after unpublish.
7. Self-heal: upload via the API, then delete a variant object directly (import `env` from
   `cloudflare:test` to touch the BUCKET binding) and assert the variant/public routes still
   return 200 webp.
8. EXIF stripping: upload a JPEG fixture that carries EXIF (reuse/borrow the fixture approach
   from `test/unit/exif.test.ts`), fetch the public variant bytes, assert the `Exif\0\0`
   marker is absent. If miniflare's local Images simulation turns out not to re-encode enough
   to strip EXIF, keep the test but assert against the real behavior and leave a comment —
   don't silently drop the case.

Update existing `photos.test.ts` variant tests if the response headers/shape changed (they
shouldn't, beyond content flowing from R2 now). The test wrangler config
(`test/integration/wrangler.jsonc`) already declares the `IMAGES` binding — miniflare's local
simulation resizes with low fidelity, which these tests don't depend on beyond "returns image
bytes".

## Phase 9 — Docs

- Add a short "Deployment" note to `docs/cloudflare-setup.md`: no new infra is required
  (works on workers.dev; no custom domain, no purge API token, no zone transformation
  settings). Free-tier Images covers 5,000 transforms/month ≈ 1,600 uploads.
- Update the stale comment in `raw.get.ts` ("variants come in M6").

## Explicitly out of scope

- Edge caching of public routes (`caches.default`) — add later only if a public photo sees
  real traffic; it would reintroduce a (bounded, 1h) purge consideration.
- Album/folder-level publishing, expiring share links, and view analytics.
- Any use of `/cdn-cgi/image/` URL-mode transforms.
