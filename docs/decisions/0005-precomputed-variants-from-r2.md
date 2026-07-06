# ADR 0005 — Precomputed WebP variants served from R2

**Status:** Accepted · 2026-07 — implemented in the public-photos sprint (P1–P9, `git log`
`[P#]` tags). Supersedes the serving layer of [ADR 0004](./0004-public-photo-serving.md); ADR
0004's token/revocation model, uniform 404s, private bucket, and trash-implies-unpublish rules
carry over unchanged and are restated here where they bind the implementation.

## Context

ADR 0004 settled the public/private *sharing* model but assumed serving went through
`/cdn-cgi/image/` URL-mode transforms. That serving layer was abandoned before implementation
because it forced hard dependencies we didn't want for a personal library that has never been
deployed:

- a **custom domain** (`/cdn-cgi/image/` only exists on a zone, not `workers.dev`),
- a **zone purge API token** as a Worker secret (revocation depended on purge-by-URL),
- zone image-transformation settings + a sources allowlist,
- a per-view billing surface (URL-mode dedupes per calendar month, but the option string is
  client-controlled — see ADR 0004 residual risk #3).

The design question this ADR answers: **how do we serve bounded, EXIF-stripped renditions for
both the private (owner) and public (tokened) paths with no new infra and no per-view transform
billing?**

## Decision

**Precompute three fixed WebP variants per photo at upload time, store them in R2, and serve
every view as a pure R2 read.** The Cloudflare Images binding is used *only* as an upload-time
resize function, never on a per-view serving path.

### Variants

`server/utils/variants.ts` is the single source of truth for sizing, keys, and generation:

- `VARIANT_SIZES = { thumb: 800, md: 1280, lg: 2560 }` — the **longest side** in device pixels,
  bounded with `fit: "scale-down"` (never upscales). Orientation is read once via `images.info()`
  and only the longest side is constrained (`width` for landscape, `height` for portrait) — passing
  *both* dimensions makes the binding pad to an N×N black box, which shows as letterboxing under
  `object-cover`. Output is `image/webp` quality 88.
- R2 key: `variants/{photoId}/{size}`.
- **WebP re-encode strips EXIF natively** — no `metadata: "none"` option is needed for the public
  path to be location-safe; the integration suite (P8) asserts the `Exif\0\0` marker is absent
  from public bytes.

### Self-healing

Serving is `getOrCreateVariant`: R2 `get` the variant key; on a hit, stream it. On a miss,
regenerate **all** sizes from the original, stamp `variants_generated_at`, and return the
requested size. Consequences:

- Upload-time generation is **non-fatal** — the row and original are already durable, so a
  transform failure just leaves `variants_generated_at` NULL and the first view heals it.
- Pre-existing photos need **no backfill script** — first view migrates them. (This is why
  the original plan's "Phase 6 — backfill" was dropped.)

### Serving routes

- **Private** (`GET /api/photos/:id/variant?size=`, session-gated by `server/middleware/auth.ts`):
  fetch `{ id, r2_key }` → `getOrCreateVariant` → stream `image/webp` with
  `cache-control: private, max-age=31536000, immutable`.
- **Public** (`GET /p/:token/:size`, in `server/routes/` so the auth middleware never gates it):
  cheap `^[0-9a-f]{32}$` token shape guard → `SELECT ... WHERE public_token = ? AND
  visibility = 'public' AND deleted_at IS NULL` → `getOrCreateVariant` → stream with
  `cache-control: public, max-age=3600` and `access-control-allow-origin: *`.
- **Public metadata** (`GET /p/:token/meta`): JSON EXIF, GPS **only** when `show_location = 1`.
  Never emits `id`, `r2_key`, or the raw `other_data` blob.

### Revocation with no edge cache

Because nothing is edge-cached (R2 reads go through the Worker), **unpublish is a flag flip** —
the next request 404s. No purge API, no zone token. Token rotation on every publish remains the
revocation primitive (ADR 0004 Q1). The public `max-age=3600` is the only residual window, held
by browsers/proxies, not our infra.

### Uniform 404s (security-critical, restated from ADR 0004)

Every public failure path — bad size, bad token shape, no row, private, or trashed — returns an
**identical bare `Response("Not found", { status: 404 })`** via `publicNotFound()` in
`server/utils/public.ts`. This is *not* `createError`: for non-`/api` routes Nitro/Nuxt catches a
thrown error and renders the SPA HTML shell with **HTTP 200**, which would make a revoked token
look alive and leak app HTML. P8 caught exactly this bug and fixed it with the bare-Response
pattern.

### Trash / delete interplay

Both soft-delete handlers clear `visibility`, `public_token`, and `published_at` in the same
UPDATE that sets `deleted_at` (restore never re-publishes). Hard delete (`purgePhotos`) removes
the three `variants/{id}/{size}` objects alongside the original.

## Consequences

**Gained:**
- **No new infra** — works on `workers.dev` as-is. No custom domain, no purge token, no zone
  transformation settings, no sources allowlist to maintain.
- **No per-view transform billing.** Images binding calls happen once per photo at upload (three
  transforms) plus rare self-heal fills. Free-tier Images (5,000 transforms/month) covers
  ~1,600 uploads/month. Steady-state serving cost is R2 reads only.
- **Simple revocation** — no cache-purge race, no browser-cache-vs-edge-cache reasoning beyond a
  1-hour public TTL.

**Accepted trade-offs:**
- **Three fixed sizes, no arbitrary widths.** URL-mode's per-request sizing is gone; the share UI
  emits `md`/`lg` links only. Fine for embed-in-a-forum-post; revisit if responsive `srcset` with
  many widths is ever wanted.
- **~3× original storage** in R2 for the variant objects. Cheap at personal-library scale.
- **Upload latency** absorbs three sequential transforms (sequential, not `Promise.all`, to bound
  Worker memory against the 25 MB/file upload cap).
- **No public view analytics** beyond Worker logs — but since serving is not edge-cached, every
  public hit *does* reach the Worker (unlike ADR 0004's edge-cached model), so per-token request
  logging is actually available here if wanted later.
- **No edge caching of public routes** — deliberately out of scope (would reintroduce a bounded
  purge consideration). Add `caches.default` only if a public photo ever sees real traffic.
