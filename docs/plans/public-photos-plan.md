# Autonomous Build Plan — precomputed variants + public/private photo serving

This file is **both the spec and the state store** for an unattended build loop, in the same shape
as `docs/plans/tiers-1-3-autonomous.md`. A driver session (the "orchestrator") reads the ledger,
delegates the next `todo` task to a subagent, verifies the gate, commits, marks it `done`, and
repeats. It runs without human input **until it reaches the design pass (P7b), which is
intentionally reserved for the user** — the loop stops there and hands back.

**Supersedes the serving design in ADR 0004** (its token/revocation model survives; its
`/cdn-cgi/image/` serving layer does not). Read ADR 0004's Context section first for why.

Point the loop at this file (see **How to run** at the bottom).

---

## Design summary (context for every task)

- At upload, generate three fixed WebP variants of each photo with the Images binding and store
  them in R2 (`variants/{id}/{size}`). The binding is used **only** as an upload-time resize
  function — never on a per-view serving path.
- Serving (private and public) is: auth/token check → R2 get → stream. No `/cdn-cgi/image/`, no
  purge API, no custom-domain dependency.
- Variants are **self-healing**: any serving route that misses the variant object generates it from
  the original on the spot and persists it. Backfill of pre-existing photos is automatic and
  upload-time generation failure is non-fatal.
- Public access is by unguessable per-photo token, rotated on every publish. Unpublish = flag flip;
  the next request 404s (no edge-cache purge needed since nothing is edge-cached).
- EXIF never ships in public bytes. Public metadata is served as JSON from a companion endpoint,
  with GPS gated behind a separate per-photo opt-in.

**On the UI (why P7 is split):** the share/badge UI has two separable parts. **P7a** is the
functional wiring (endpoints called, state updated, URLs copyable, badge shown) — mechanical and
verifiable by clicking through, so it runs autonomously. **P7b** is the design pass against Bright
Studio Glass — a taste judgment tests can't gate, and something the user reviews personally. The
loop runs everything **through P7a**, then stops with the feature working end-to-end so the user
can give design feedback from a live surface. P7b is never delegated to a subagent.

---

## Ground rules (apply to every task)

- **Branch:** commit directly to `main` (this is a local-only repo — project convention).
- **One task = one feature commit.** Each task lands as a single, self-contained, cherry-pickable
  commit. Do **not** bundle two tasks. Do **not** leave a task half-committed.
- **Commit message format:** `<type>: <summary> [<task-id>]`, e.g.
  `feat: precomputed WebP variants + R2 storage [P2]`. The `[P#]` tag is how the loop and `git log`
  identify a task's commit — always include it.
- **Definition of Done (hard gate — all must pass before the feature commit):**
  1. `npm run check` (Biome) — auto-fixes formatting; must end clean.
  2. `npm run typecheck` — zero errors.
  3. `npm run test:all` — unit + integration suites green. (Integration runs `npm run build` first,
     so this is the slow gate; budget for it.)
  4. New DB migrations must apply cleanly (`npm run db:migrate:local`). Dedicated per-task test
     coverage is specified where it belongs (P8 consolidates the new public-route integration
     suite); a task that changes an endpoint must at minimum keep existing integration tests green,
     updating them if the response shape legitimately changed.
  5. Manual/behavioral sanity is encouraged but the automated gate above is what blocks the commit.
- **Migrations:** additive only; next sequential number (`000N_*.sql`) in
  `server/db/migrations/`. Never edit a prior migration. Run `npm run db:migrate:local` after adding.
- **Security altitude (P4/P5/P8):** the public routes are unauthenticated. Uniform 404s only — never
  reveal whether a token exists, is private, or is trashed. No `id`/`r2_key`/raw-EXIF in any public
  response. Treat these as the sensitive core; the subagent must not "simplify" the 404 uniformity
  or the GPS opt-in away.
- **Design language (P7a):** match the existing "Bright Studio Glass" tokens and component patterns
  (`app/assets/css/main.css`, `app/components/ui/`, `docs/imgthing-ui.md`). Reuse shadcn/reka
  components already present; don't introduce a new UI kit. P7a uses plain-but-correct placeholders
  for anything that is a taste call (badge styling, "rotates the link" copy) — those are P7b's job.
- **Stay in scope.** Implement only the current task's spec. If you spot adjacent work, note it in
  the task's ledger row; don't do it.

---

## Loop protocol (the orchestrator follows this exactly, every iteration)

Each iteration does **one** task, then the loop fires again with fresh context. The heavy
implementation lives in a **subagent's** context so the orchestrator's context stays small.

1. **Sync state.** Read the **Task ledger** below and `git log --oneline -20`.
2. **Crash recovery.** If a task is marked `in_progress`:
   - If a commit tagged with its `[P#]` exists in `git log` → it actually finished; set it to `done`
     and continue.
   - Otherwise the prior attempt died mid-task → discard partial work (`git checkout . &&
     git clean -fd`), reset that task to `todo`, and treat it as the next task.
3. **Pick.** Choose the **first** task whose status is `todo`, in ledger order (top to bottom). The
   order is dependency-optimized — do not reorder. **Never pick a `hold` task** (that's P7b, the
   human design pass).
4. **Claim.** Edit this file to set that task's status to `in_progress`. Commit just that ledger
   change: `chore: claim [P#]`. (No-repick guarantee, durable across restarts.)
5. **Delegate.** Spawn a **general-purpose subagent** with the task's full spec section pasted in,
   plus the Ground rules above. Instruct it to: implement to completion, satisfy the entire
   Definition of Done, and create the single feature commit with the `[P#]` tag. It must report
   back: commit SHA, what it changed, and gate results.
6. **Verify.** After the subagent returns, independently confirm the `[P#]` feature commit exists,
   and re-run the gate if the report is ambiguous (`npm run typecheck && npm run test:all`). Do
   **not** trust a claim of green without evidence in the transcript.
7. **Record.**
   - On success: set the task to `done`, append a one-line result note, commit `chore: mark [P#] done`.
   - On unresolvable failure: set the task to `blocked` with a one-line reason, commit
     `chore: block [P#] — <reason>`, and move on (don't halt the whole run for one task).
8. **Continue or stop.** If any `todo` tasks remain → let the loop fire again. If **no `todo`
   remains** (all `done`/`blocked`, with P7b still `hold`) → update `docs/PROGRESS.md` with a short
   summary of what landed, then **stop the loop and notify the user**: the public-photos feature is
   functionally complete end-to-end and **P7b (design pass) is ready for their review**. Do not
   delegate or execute P7b. Do not reschedule.

**Context hygiene:** the orchestrator keeps only the ledger + short per-task summaries in its head.
Never read large implementation files in the orchestrator — that's the subagent's job.

---

## Task ledger

Statuses: `todo` · `in_progress` · `done` · `blocked` · `hold` (human-only, never auto-picked).
Edit in place as the loop runs.

| #    | Task                                          | Status | Result note |
|------|-----------------------------------------------|--------|-------------|
| P1   | Migration 0006 (public sharing columns)       | done   | 0006: 5 additive cols + unique token index; migration-only, no TS schema to sync |
| P2   | Variant utility (`server/utils/variants.ts`)  | done   | variants.ts: sizes/keys/generate/self-heal; longest-side scale-down webp q88; WebP output strips EXIF natively (no metadata opt) |
| P3   | Upload generates variants                     | in_progress |        |
| P4   | Serving rewrite + publish/unpublish + public routes | todo |         |
| P5   | Trash/delete interplay                        | todo   |             |
| P8   | Integration tests (public suite + updates)    | todo   |             |
| P9   | Docs                                          | todo   |             |
| P7a  | Functional share UI (autonomous)              | todo   |             |
| P7b  | **Design pass — HUMAN, loop stops here**      | hold   | Awaiting user design review; never delegate |

**Why this order (dependencies):** P1 (schema) unblocks everything. P2 (util) is imported by P3/P4.
P3 (upload path) and P4 (serving + sharing) are the backend core; P4 is the security-sensitive
heavyweight and depends on P2's `getOrCreateVariant`. P5 (trash interplay) touches the delete
handlers and `purgePhotos`, so it lands after the routes it protects exist. P8 writes the new
integration suite once all backend behavior is in place — it is the real verification of the
unauthenticated routes. P9 (docs) is prose, no code dependency. **P7a is intentionally last of the
autonomous tasks** so the user gives design feedback from a fully-working surface. P7b is
human-only. **Phase 6 (backfill) from the original plan is dropped: the P2 self-heal path migrates
existing photos on first view, and there's no deployed data — no script needed.**

---

## Task specs

Each subagent gets **one** of these sections. Specs are at spec-altitude: the subagent reads the
current code itself. Acceptance criteria are the contract.

### P1 — Migration 0006 (public sharing columns)

**Goal:** additive schema for public sharing + precomputed-variant bookkeeping.

Create `server/db/migrations/0006_public_photos.sql`:

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

`visibility` values are `'private' | 'public'`, enforced in app code (no CHECK — keeps the ALTER
simple). The unique index tolerates many NULLs (SQLite semantics). Run `npm run db:migrate:local`;
the integration test pool applies migrations itself from `migrations_dir`.

**Acceptance:** migration applies cleanly locally and in the test pool; `test:all` + `typecheck` +
`check` green. (No new endpoint yet, so no new integration test.)

### P2 — Variant utility (`server/utils/variants.ts`, new)

**Goal:** centralize variant sizing, keys, and the generate/self-heal logic used by upload and all
serving routes.

Move `SIZES` out of `server/api/photos/[id]/variant.get.ts` into here and export:

```ts
export const VARIANT_SIZES = { thumb: 800, md: 1280, lg: 2560 } as const;
export type VariantSize = keyof typeof VARIANT_SIZES;
export function isVariantSize(v: string | undefined): v is VariantSize;
export function variantKey(photoId: string, size: VariantSize): string; // `variants/${photoId}/${size}`
```

**Orientation change:** transforms switch from width-only to a longest-side bounding box —
`transform({ width: N, height: N, fit: "scale-down" })`, output `{ format: "image/webp",
quality: 88 }`. `scale-down` fits within N×N preserving aspect ratio and never upscales, so
portrait/landscape/square get equal pixel budgets. Preserve the existing retina-sizing rationale
comment from `variant.get.ts` and extend it with the longest-side reasoning. Check
`worker-configuration.d.ts` for a `metadata` option on the transform/output types; if present, set
it to `"none"`. Either way, P8 asserts variant bytes carry no EXIF.

Core functions (both take bindings as arguments, matching the `purgePhotos` style in
`server/utils/photos.ts`):

- `generateVariants(images, bucket, photoId, original: ArrayBuffer)` — for each size, run the
  transform (fresh `.input()` per size — the binding consumes its input stream; make a new
  `ReadableStream`/blob stream from the buffer each time) and `bucket.put(variantKey(...), bytes,
  { httpMetadata: { contentType: "image/webp" } })`. `result.image()` returns a ReadableStream — R2
  `put` needs a known length, so buffer it (`new Response(stream).arrayBuffer()`). Originals are
  capped at 25 MB (upload limit), so three sequential buffered transforms are fine for Worker
  memory; do the sizes sequentially, not `Promise.all`.
- `getOrCreateVariant(db, images, bucket, photo: { id, r2_key }, size)` — `bucket.get` the variant
  key; on hit return the R2 object body. On miss (self-heal): get the original from R2 (404 if
  missing), run `generateVariants` for **all** sizes (a miss for one usually means all are missing;
  generating all avoids three separate heal round-trips), stamp `variants_generated_at =
  datetime('now')`, and return the requested size's bytes.

**Acceptance:** util compiles and exports the above; nothing that imports the old `SIZES` breaks
(update `variant.get.ts` import if needed to keep it building — the full rewrite is P4); gate green.

### P3 — Upload generates variants

**Goal:** precompute the three variants at upload time so serving is a pure R2 read.

In `server/api/photos/index.post.ts`, after the D1 batch insert succeeds for a file, call
`generateVariants(...)` with the `bytes` buffer already in scope, then `UPDATE photos SET
variants_generated_at = datetime('now') WHERE id = ?`.

Wrap it in try/catch and **do not fail the upload** if generation throws — the photo row and
original are already durable, and serving self-heals. On failure, `console.error` and leave
`variants_generated_at` NULL. Keep per-file, inside the existing loop.

**Acceptance:** uploading a photo persists three `variants/{id}/{size}` objects and stamps
`variants_generated_at`; a forced generation failure still returns a successful upload; existing
upload integration tests stay green; gate green.

### P4 — Serving rewrite + publish/unpublish + public routes

**Goal:** the serving + sharing core. Private serving reads variants from R2; owners can
publish/unpublish; unauthenticated tokened routes serve public bytes + metadata. **Security-
sensitive — read the Ground rules "Security altitude" note.**

**4a. `server/api/photos/[id]/variant.get.ts` (rewrite).** Keep the route shape (`?size=` validated
against the allowlist via `isVariantSize`, 400/404 behavior, session auth via middleware). Body
becomes: fetch `{ id, r2_key }` row → `getOrCreateVariant` → stream with `content-type: image/webp`
and the existing `cache-control: private, max-age=31536000, immutable`. `raw.get.ts` is unchanged.
Update the existing `photos.test.ts` variant tests only if the response shape legitimately changed
(it shouldn't beyond content now flowing from R2).

**4b. Publish/unpublish (session-gated, under `/api`).**

`server/api/photos/[id]/publish.post.ts`:
- 404 if the photo doesn't exist or is trashed (`deleted_at IS NOT NULL`).
- Body (optional): `{ showLocation?: boolean }`, default false.
- Generate a **fresh token every time** (rotation is the revocation primitive — a re-publish must
  mint a new URL): 16 bytes from `crypto.getRandomValues`, hex-encoded (32 chars, 128 bits). Small
  helper `generatePublicToken()` in `server/utils/photos.ts`.
- `UPDATE photos SET visibility='public', public_token=?, published_at=datetime('now'),
  show_location=? WHERE id=?`.
- Return `{ token, urls: { thumb, md, lg, meta } }` built from the request origin
  (`getRequestURL(event).origin`).

`server/api/photos/[id]/unpublish.post.ts`:
- `UPDATE photos SET visibility='private', public_token=NULL, published_at=NULL WHERE id=?`
  (idempotent; 404 only if the photo doesn't exist). No purge step exists in this design.

**4c. Public routes (new, outside `/api` so `server/middleware/auth.ts` skips them).** Nitro
non-API routes live in `server/routes/`. The `/p/**` namespace has no page-route collision
(`app/middleware/auth.global.ts` only affects pages).

`server/routes/p/[token]/[size].get.ts`:
1. Validate `size` with `isVariantSize` → 404 otherwise (uniform 404s everywhere on this route).
2. Cheap token shape guard before D1: `/^[0-9a-f]{32}$/` → 404.
3. `SELECT id, r2_key FROM photos WHERE public_token = ? AND visibility = 'public' AND
   deleted_at IS NULL` → 404 on miss.
4. `getOrCreateVariant` (self-heal applies here too — bounded: once per photo+size ever) → stream:
   - `content-type: image/webp`
   - `cache-control: public, max-age=3600` (browsers/proxies may hold copies for ≤1h after
     unpublish — the accepted revocation window; do not raise without reconsidering that)
   - `access-control-allow-origin: *`

`server/routes/p/[token]/meta.get.ts`:
- Same token guard + same D1 predicate, joined to `exif_data`; also select `show_location`,
  `original_filename`, `published_at`.
- Return JSON `{ filename, takenAt, camera: { make, model }, lens, exposure, aperture, iso,
  focalLength, publishedAt, gps }` where `gps` is `{ latitude, longitude }` **only when
  `show_location = 1` and coordinates exist**, else `null`. Never include `id`, `r2_key`, or
  `other_data` (the raw EXIF blob may itself contain GPS/serials).
- Headers: `access-control-allow-origin: *`, `cache-control: public, max-age=300`.

**Acceptance:** private variant serving streams webp from R2; publish returns a 32-hex token + urls;
`/p/{token}/{size}` and `/p/{token}/meta` serve without a session; all failure paths return uniform
404s; existing tests green (full new suite is P8); gate green.

### P5 — Trash/delete interplay

**Goal:** trashing a photo revokes any public link; hard delete removes variant objects.

- **Trash implies unpublish:** in the soft-delete handlers (`server/api/photos/[id]/index.delete.ts`
  and the bulk `server/api/photos/index.delete.ts`), the UPDATE that sets `deleted_at` also sets
  `visibility='private'`, `public_token=NULL`, `published_at=NULL`. Restoring from trash does
  **not** re-publish (deliberate — restore should never silently re-expose). The public routes'
  `deleted_at IS NULL` predicate is belt-and-suspenders on top.
- **Hard delete removes variants:** in `purgePhotos` (`server/utils/photos.ts`), extend the R2
  `Promise.all` to also delete `variantKey(r.id, size)` for the three sizes (same `.catch(() => {})`
  tolerance).

**Acceptance:** soft-deleting a published photo clears its token and 404s any prior public URL;
hard delete removes the variant objects; existing delete tests green; gate green.

### P8 — Integration tests (public suite + updates)

**Goal:** the real verification of the unauthenticated surface. Extend `test/integration/`, reuse
`helpers.ts` login/pngBytes. This task must not weaken any security invariant to make a test pass.

New `test/integration/public.test.ts`:
1. publish requires auth (401 without cookie); publish returns a 32-hex token + urls.
2. `GET /p/{token}/md` succeeds **without** a session cookie, `content-type: image/webp`,
   `cache-control` contains `public`.
3. Uniform 404s: unknown token, valid-shape-but-wrong token, size outside the allowlist, token of a
   photo after unpublish, token of a trashed photo.
4. Rotation: publish → unpublish → publish again yields a different token, and the first token 404s.
5. Trash-implies-unpublish: publish, soft-delete, assert `/p/{old-token}/md` 404s and the photo row
   shows `public_token IS NULL` (assert via API responses, not raw D1).
6. Meta endpoint: GPS absent by default, present with `showLocation: true`; no `r2_key`/`id` keys in
   the JSON; works without auth; 404 after unpublish.
7. Self-heal: upload via the API, then delete a variant object directly (import `env` from
   `cloudflare:test` to touch the BUCKET binding) and assert the variant/public routes still return
   200 webp.
8. EXIF stripping: upload a JPEG fixture carrying EXIF (reuse/borrow the fixture approach from
   `test/unit/exif.test.ts`), fetch the public variant bytes, assert the `Exif\0\0` marker is
   absent. If miniflare's local Images simulation turns out not to re-encode enough to strip EXIF,
   keep the test but assert against the real behavior and leave a comment — **don't silently drop
   the case** (note it in the ledger result if you have to soften it).

Update existing `photos.test.ts` variant tests if the response headers/shape changed (they
shouldn't, beyond content flowing from R2). The test wrangler config
(`test/integration/wrangler.jsonc`) already declares the `IMAGES` binding.

**Acceptance:** the new suite passes; all eight scenarios present (or explicitly annotated per the
EXIF caveat); full `test:all` green; gate green.

### P9 — Docs

**Goal:** document that no new infra is needed and fix the stale variant comment.

- Add a short "Deployment" note to `docs/cloudflare-setup.md`: no new infra required (works on
  workers.dev; no custom domain, no purge API token, no zone transformation settings). Free-tier
  Images covers 5,000 transforms/month ≈ 1,600 uploads.
- Update the stale comment in `raw.get.ts` ("variants come in M6").

**Acceptance:** docs updated; gate green (docs-only, but still run the gate).

### P7a — Functional share UI (autonomous)

**Goal:** wire the sharing feature into the UI so it works end-to-end. Reuse existing shadcn/reka
components and the favorite-indicator treatment. **Placeholders (not final design) for anything
that is a taste call — that's P7b.**

- Extend the `Photo` interface (`app/components/PhotoViewer.vue:39`) and the list SELECT in
  `server/api/photos/index.get.ts` with `visibility`, `public_token`, `show_location`.
- **Share control in the PhotoViewer action bar:** a Share button opening a popover/dialog with:
  - a Public switch (calls publish/unpublish; on publish success, update local state with the
    returned token),
  - a "Show location" switch (visible only when the photo has GPS; toggling while public re-calls
    publish — plain functional behavior; the "this rotates the link" UX copy is P7b),
  - copy-to-clipboard rows for the md and lg public URLs (build as
    `${location.origin}/p/${token}/${size}`),
  - when already public, a subtle placeholder hint that links break on unpublish/re-publish.
- **Public indicator:** a small badge/icon (e.g. globe) on grid tiles and in the viewer for
  `visibility === 'public'`, consistent with the existing favorite indicator. Functional placement
  now; final styling is P7b.
- Bulk actions: out of scope; publish is per-photo only.

**Acceptance:** in the running app, toggling Public publishes and shows the badge, a copied
`/p/{token}/{size}` URL loads in a fresh/incognito context without auth, unpublish makes it 404, and
the "Show location" switch appears only for geotagged photos. Verify with the run/verify skill. Gate
green.

### P7b — Design pass (HUMAN — the loop stops before this)

**Not for a subagent.** After P7a lands, the feature works end-to-end and the user reviews the live
surface against Bright Studio Glass (`docs/imgthing-ui.md`) and gives design direction. Scope of the
pass: badge styling and placement, the Share popover's visual language, the "toggling location
rotates the link" copy, the unpublish/re-publish warning treatment, and overall on-brand fit.
The orchestrator stops the loop when this is the only remaining task and notifies the user.

---

## Explicitly out of scope

- Edge caching of public routes (`caches.default`) — add later only if a public photo sees real
  traffic; it would reintroduce a (bounded, 1h) purge consideration.
- Album/folder-level publishing, expiring share links, and view analytics.
- Any use of `/cdn-cgi/image/` URL-mode transforms.

---

## How to run

Start a self-paced loop pointed at this plan (no interval → the model paces itself, one task per
iteration):

```
/loop Follow docs/plans/public-photos-plan.md. Execute the "Loop protocol" section exactly: each
iteration, sync the ledger + git log, run crash recovery, pick the first `todo` task (never a `hold`
task), claim it, delegate the full implementation to a general-purpose subagent (pasting that task's
spec + the Ground rules), verify the gate and the `[P#]` commit, then mark it `done` (or `blocked`
with a reason) and commit the ledger update. One task per iteration to keep context small. When no
`todo` tasks remain (P7b stays `hold`), update docs/PROGRESS.md, then STOP and tell me the feature
is functionally complete and P7b (design pass) is ready for my review — do not execute P7b, do not
reschedule. Run unattended through P7a; do not ask for input before then.
```

Restart-safe: if interrupted, just start the loop again — it reconciles from the ledger + `git log`
and resumes at the next unfinished task. The loop will never auto-run P7b.
