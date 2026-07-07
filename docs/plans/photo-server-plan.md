# Photo Server Plan (v2) — Cloudflare-native

The architecture overview for imgthing. Reasoning for the stack lives in the ADRs
(`../decisions/`); running status lives in `../PROGRESS.md`; the spent per-sprint build ledgers are
in `./archive/`.

**Status: shipped and live.** All milestones below are complete and the app is deployed to production
(see [ADR 0006](../decisions/0006-production-deploy-and-operations.md)).

## Architecture

```
Browser (Nuxt SSR)
   │
   ▼
Cloudflare Worker (Nuxt via nitro cloudflare_module preset)
   │              │                    │
   ▼              ▼                    ▼
Cloudflare D1   Cloudflare R2      Cloudflare Images
(metadata)      (originals +       (upload-time variant
                 WebP variants)     transforms only)
```

Serving is a pure R2 read: three fixed WebP variants are precomputed per photo at upload and stored
in R2 (`variants/{id}/{size}`); the Images binding is used **only** at upload time, never on a
per-view path. See [ADR 0005](../decisions/0005-precomputed-variants-from-r2.md).

## Data model

Single owner — no `users` table, no per-row scoping. Schema is defined by the migrations in
`server/db/migrations/` (`0001`–`0008`):

- **folders** — id, name, parent_folder_id, timestamps
- **photos** — id, original_filename, r2_key, content_type, file_size, timestamps; plus
  `deleted_at` (soft-delete tombstone, `0005`), `visibility`/`public_token`/`published_at`/
  `show_location`/`variants_generated_at` (public sharing, `0006`), `content_hash` (dup detection,
  `0008`)
- **exif_data** — camera/lens/exposure/aperture/iso/focal_length, taken_at, gps_latitude,
  gps_longitude, other_data (JSON TEXT)
- **folder_photos**, **tags** + **photo_tags** — many-to-many junctions (`0002`, `0004`)
- **login_attempts** — per-IP brute-force throttle state (`0007`)

## Milestones — all complete

1. **Foundation** — Nuxt on Workers, D1 + R2 + Images bindings, local dev with emulated bindings. ✅
2. **Auth** — hand-rolled single-owner login + signed session cookie ([ADR 0003](../decisions/0003-hand-rolled-auth.md)). ✅
3. **Upload + Storage** — upload UI, originals to R2, D1 record, EXIF extracted at upload. ✅
4. **Folder Management** — folder CRUD, nesting, move-between-folders. ✅
5. **Gallery UI** — responsive grid, server-side search/paging/sort, multi-select. ✅
6. **Photo Viewing** — lightbox, EXIF panel + editing, precomputed variants, map view, dark mode. ✅
7. **Search & Polish** — filename search, camera/lens facets, tags, favorites, trash, mobile pass. ✅
8. **Deployment Hardening** — deployed to production; brute-force throttle + soft-delete shipped.
   Backups (D1 Time Travel + R2 versioning) and bulk export remain open — see `../PROGRESS.md`. ◑

## Cost (ballpark, mid-2026 pricing)

~$5/mo at 1k images (mostly the Workers Paid base fee for CPU headroom); ~$8–9/mo at 10k images
+ 10k transforms. R2/D1/Images are effectively free at personal scale.
