# Progress

Milestones M1–M6 and backlog T1–T10 are **done** (auth, upload+EXIF, folders, gallery, viewer,
Images variants, delete, search/pagination, sort, multi-select, favorites, tags, upload page, map,
dark mode) plus a design/UX polish pass. The feature set is complete locally. Full history is in git.

The next sprint is about making it **real and safe to run** — it has never been deployed, it's a
single passphrase on the open internet, and photo deletes are currently irreversible. Ranked by
risk × value.

## Shipped this sprint (autonomous S1–S6)

Driven unattended by [next-sprint-autonomous.md](./plans/next-sprint-autonomous.md). All six tasks
landed with the gate green (`check` + `typecheck` + `test:all`; integration suite now 63 tests).

- **S1 — Soft delete / trash** (`139da58`): `photos.deleted_at` tombstone (migration `0005`),
  `DELETE /api/photos/[id]` now soft-deletes, `POST …/restore`, `?purge=1` + `DELETE /api/photos/trash`
  for permanent removal via shared `purgePhotos` helper; all listings + geo exclude tombstones; Trash
  sidebar view with Restore / Delete-forever / Empty-trash.
- **S2 — Batch delete** (`ecf3a49`): collection-level `DELETE /api/photos?ids=` single-D1-write soft
  delete (+ `?purge=1`); `bulkDelete` is now one request instead of N.
- **S3 — Camera & lens filters** (`1d27aeb`): `GET /api/cameras` + `/api/lenses` facets (live-only
  counts), `camera`/`lens` params in `buildFilter` (AND-combine), Cameras/Lenses sidebar groups.
- **S4 — Upload limits** (`981cf9b`): 25 MB/file, 50 files, 200 MB batch caps; early `content-length`
  413; partial-batch `rejected[]` reporting.
- **S5 — Test coverage audit** (`469301c`): full route audit (no bugs found); closed real gaps
  (cameras/lenses/trash auth guards, folder 404s).
- **S6 — Mobile / responsive pass** (`44dab60`): icon-only action bar on phones, phone-friendly
  viewer drawer, offcanvas sidebar closes on nav select, `SidebarEntry` menu gated to `#menu` slot.

**Still open from the list below:** deploy/provision (P0), login brute-force protection (P0),
backups (P1), bulk download/export (P2) — intentionally out of this autonomous sprint's scope.

## Shipped this sprint (autonomous public-photos P1–P9, P7a)

Driven unattended by [public-photos-plan.md](./plans/public-photos-plan.md), which supersedes the
serving layer in ADR 0004. Precomputed WebP variants in R2 + tokened public/private serving with no
new infra (no `/cdn-cgi/image/`, no purge API, no custom domain). All tasks landed with the gate
green (`check` + `typecheck` + `test:all`; integration suite now 72 tests, 8 files). **P7b (design
pass) is intentionally reserved for human review and was not executed.**

- **P1 — Migration 0006** (`ffe1a0c`): additive `visibility`/`public_token`/`published_at`/
  `show_location`/`variants_generated_at` columns on `photos` + unique token index.
- **P2 — Variant utility** (`4c98119`): `server/utils/variants.ts` — sizes/keys plus
  `generateVariants` and self-healing `getOrCreateVariant`; longest-side `scale-down` WebP q88
  (WebP re-encode strips EXIF natively).
- **P3 — Upload generates variants** (`3188a1c`): per-file `generateVariants` + `variants_generated_at`
  stamp in the upload loop; non-fatal on failure (serving self-heals).
- **P4 — Serving + sharing core** (`66cdeb7`): private variant route reads from R2; session-gated
  publish (mints a fresh 32-hex token every call) / unpublish; unauthenticated `/p/{token}/{size}`
  and `/p/{token}/meta` routes; uniform 404s; GPS opt-in gated behind `show_location`.
- **P5 — Trash/delete interplay** (`5d44271`): both soft-delete handlers clear the token + visibility
  in the same UPDATE (restore never re-publishes); `purgePhotos` also deletes the three variant objects.
- **P8 — Public integration suite** (`cf66966`): `test/integration/public.test.ts`, all 8 scenarios
  (auth, cookieless serving, uniform 404s, rotation, trash-unpublish, meta/GPS, self-heal, EXIF-strip).
  Caught + fixed a real bug: `/p/**` threw `createError` which Nitro rendered as the SPA HTML shell
  with HTTP 200 — a revoked token "looked alive"; now returns a bare 404 `Response`.
- **P9 — Docs** (`c930b91`): deployment note in `cloudflare-setup.md` (no new infra); fixed the stale
  "variants come in M6" comment.
- **P7a — Functional share UI** (`e2e9941`): Share dialog in the viewer (Public switch, GPS-gated
  "Show location" switch, md/lg copy-to-clipboard rows), globe badge on grid tiles + viewer;
  publish/unpublish wired through `useLibrary` mirroring the favorite toggle. Taste calls left as
  placeholders for P7b.

**Reserved for human review:** **P7b — design pass** against Bright Studio Glass (badge styling +
placement, Share dialog visual language, "toggling location rotates the link" copy, unpublish/
re-publish warning treatment). The feature works end-to-end from a live surface; this is a taste
judgment, not delegated.

## Next sprint

### P0 — Ship it

- **Provision + deploy.** `database_id` is still `REPLACE_WITH_D1_DATABASE_ID`. Create remote D1/R2,
  enable Cloudflare Images, apply remote migrations, set secrets (`APP_PASSPHRASE`, `SESSION_SECRET`),
  first `wrangler deploy`, add `gritts.net` + Workers Custom Domain. See
  [cloudflare-setup.md](./cloudflare-setup.md). Nothing else in this list matters until this lands.
- **Login brute-force protection.** `POST /api/auth/login` compares the passphrase with no rate
  limit or lockout — once public it's an open guessing target. Add per-IP throttling (KV or D1
  counter + backoff) before or immediately alongside deploy.

### P1 — Don't lose photos

- **Soft delete / trash.** `DELETE /api/photos/[id]` hard-deletes the R2 object + D1 rows with no
  recovery — the worst failure mode for a photo library. Move to a `deleted_at` tombstone + a Trash
  view + restore, purge R2 on empty-trash only.
- **Batch delete endpoint.** Bulk delete currently fires N parallel per-photo DELETEs (best-effort,
  partial failure leaves mixed state). Add one `DELETE /api/photos` taking `ids`, single D1 batch.
- **Backups.** Enable D1 Time Travel + R2 object versioning; sketch an export-everything job.

### P1 — Cover the untested endpoints

- Integration tests exist for auth/folders/photos/tags but **not** for the newer routes: favorite
  toggle, `variant`, photo delete, `geo`, and upload-with-`folderId`. Add these before deploy so
  the migration to remote doesn't regress them silently.

### P2 — Filter by equipment (Cameras / Lenses)

- **Camera & lens filters.** User story: *filter images by camera, lens, or a camera+lens
  combination.* Add "Cameras" and "Lenses" sidebar sections alongside Folders and Tags. The EXIF
  data already exists (`exif_data.camera_model`, `lens_info` are extracted on upload and stored),
  so **no migration and no EXIF work** — this is aggregation + filter param + sidebar UI only.
  Cheapest item in this list relative to its value. Steps:
  - Aggregation routes `GET /api/cameras` and `GET /api/lenses`, modeled on `tags/index.get.ts`:
    `SELECT camera_model, COUNT(*) FROM exif_data WHERE camera_model IS NOT NULL GROUP BY …`
    (same for `lens_info`), returning name + `photo_count`.
  - Extend `buildFilter` in `server/api/photos/index.get.ts` with `camera` / `lens` params
    (the `LEFT JOIN exif_data e` is already in the query — add `e.camera_model = ?` /
    `e.lens_info = ?`). Supporting both at once gives the camera+lens combination for free.
  - `useLibrary.ts`: keyed fetches for the two lists, `selectedCamera` / `selectedLens` state with
    exclusive `select*` actions (clear-others-then-set, like tags), extend `currentTitle` +
    `refreshAll`. `index.vue`: add `else if` branches in `listQuery`.
  - `AppSidebar.vue`: two new `SidebarGroup`s reusing `<SidebarEntry>` exactly like Tags.

### P2 — Polish

- **Upload limits.** `POST /api/photos` reads each file fully into an ArrayBuffer with no max size
  or count guard — a large batch can pressure Worker memory. Add per-file size + batch-count caps.
- **Bulk download / export.** Select N → download a zip; pairs with the export-everything job.
- **Mobile / responsive pass** and a keyboard-shortcut help overlay for the viewer.
