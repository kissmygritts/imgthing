# Progress

Milestones M1–M6 and backlog T1–T10 are **done** (auth, upload+EXIF, folders, gallery, viewer,
Images variants, delete, search/pagination, sort, multi-select, favorites, tags, upload page, map,
dark mode) plus a design/UX polish pass. The feature set is complete locally. Full history is in git.

The next sprint is about making it **real and safe to run** — it has never been deployed, it's a
single passphrase on the open internet, and photo deletes are currently irreversible. Ranked by
risk × value.

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
