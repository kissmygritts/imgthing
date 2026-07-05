# Progress

## Milestone 1 — Foundation · 🟡 in progress (scaffold done, provisioning pending)

**Done (2026-07):**
- Nuxt 4 (SSR) scaffolded on nitro `cloudflare_module` preset.
- UI stack: shadcn-nuxt + reka-ui + Tailwind v4 + Biome (see ADR 0002). 13 core components in
  `app/components/ui/`. Custom neutral+blue photo-app tokens in `app/assets/css/main.css`.
- `wrangler.jsonc` with `DB` (D1), `BUCKET` (R2), `IMAGES` bindings; types generated to
  `worker-configuration.d.ts`.
- D1 schema migration `server/db/migrations/0001_init.sql` (folders/photos/exif_data).
- `server/utils/cloudflare.ts` binding helpers + `/api/health` sanity endpoint.
- Verified in local dev: all three bindings resolve, D1 query works against the migrated local
  DB, home page renders. `npm run build` passes, `biome check` clean.

**Pending (needs Cloudflare account — see [cloudflare-setup.md](./cloudflare-setup.md)):**
- Create D1 + paste `database_id`; create R2 bucket; apply remote migrations.
- Enable Cloudflare Images transformations.
- Add `gritts.net` + Workers Custom Domain.
- Deploy (⚠️ hold until auth — Milestone 2).

## Milestone 2 — Auth · ✅ done

Hand-rolled single-owner login (see ADR 0003).

- `server/utils/session.ts` — HMAC-signed cookie via Web Crypto, constant-time passphrase compare.
- Routes: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`.
- Guards: `server/middleware/auth.ts` (401 for protected `/api/**`), `app/middleware/auth.global.ts`
  (redirect pages to `/login`).
- `app/pages/login.vue` passphrase form (shadcn Card/Input/Button).
- Secrets: `APP_PASSPHRASE`, `SESSION_SECRET` in `.dev.vars` (dev) / `wrangler secret put` (prod).
- Verified end-to-end in dev: wrong passphrase → 401, correct → signed cookie, protected API 401
  without cookie / passes with it, page redirect to `/login` when unauthenticated.

## Milestone 3 — Upload + Storage + EXIF · ✅ done

Upload flows through the Worker; EXIF parsed server-side with `exifr` (ADR pending — chosen for
zero Node deps, ~27 kB gzip in the Worker bundle).

- `server/utils/exif.ts` — `extractExif()` maps EXIF onto the `exif_data` columns, stores the full
  parsed blob as JSON `other_data`, never throws (non-EXIF images → all-null).
- `POST /api/photos` — multipart upload, streams each `image/*` part to R2 under `originals/<uuid>`,
  writes `photos` + `exif_data` in one D1 batch; deletes the R2 object if the D1 write fails.
- `GET /api/photos` — newest-first list joined with EXIF summary, `limit`/`offset` paging.
- `GET /api/photos/[id]/raw` — streams the original bytes from R2 (Images variants deferred to M6).
- `app/pages/index.vue` — upload button (multi-file) + responsive gallery grid; `Toaster` mounted
  in `app.vue` for success/error toasts.
- Verified end-to-end in dev: login → upload → R2 stored → D1 row → list → raw serve returns
  byte-identical original; EXIF-bearing JPEG populates camera_make/model/iso/aperture/exposure.

## Milestone 4 — Folder Management · ✅ done

Photos belong to **many** folders (many-to-many), folders nest into a tree.

- Migration `0002_folder_photos.sql` — `folder_photos` junction (cascading FKs); migrates and
  drops the old single `photos.folder_id`.
- `server/utils/folders.ts` — `wouldCycle()` (re-parent guard) + `requireFolder()` (404 helper).
- Routes: `GET/POST /api/folders`, `PATCH/DELETE /api/folders/[id]` (rename/move with cycle guard;
  delete cascades subfolders, photos survive), `POST /api/folders/[id]/photos` (add, body),
  `DELETE /api/folders/[id]/photos?photoIds=` (remove — query, not body: DELETE-with-body hangs
  under the Workers runtime). `GET /api/photos?folderId=<id|none>` filters; each row carries
  `folder_ids` (GROUP_CONCAT) for the membership UI.
- UI: `app/components/FolderTree.vue` (recursive, expand/collapse, per-folder menu) + sidebar with
  All / Uncategorized; create/rename/delete via Dialog; per-photo dropdown with folder checkboxes.
- Tests: `test/integration/folders.test.ts` (6 cases — create/nest/rename, cycle guard,
  add/remove + filter, cascade delete keeps photos, 404). Verified end-to-end in dev.

## Milestone 6 — Photo Viewer · 🟡 POC done (variants + design deferred)

Full-screen lightbox with EXIF panel and prev/next. POC-level styling — a design pass comes later.

- `app/components/PhotoViewer.vue` — teleported fixed overlay (90% black backdrop); exports the
  shared `Photo` type (full EXIF shape from `GET /api/photos`), reused in `index.vue`.
- Info panel (toggle with the button or `i`): filename, type, size, uploaded/taken, camera, lens,
  exposure, aperture, ISO, focal length; GPS → OpenStreetMap link. Empty fields are hidden.
- Nav: prev/next buttons (hidden at ends) + ←/→ keys; `Esc` / backdrop-click / X to close; `n / N`
  counter; download link (raw bytes, `download` attr).
- `index.vue` gallery thumbnails open the viewer at their index; image still served by
  `/api/photos/[id]/raw` (Images variants still deferred).
- Verified in dev via browser: open, EXIF populated, keyboard nav updates counter/panel, Esc closes.

## Milestones 5, 7–8 · ⚪ not started

M5 gallery grid already landed with M3; remaining: grid/list toggle + paging. Then Search/Polish ·
Hardening.

## Backlog Tiers 1–3 — autonomous build · ✅ done (2026-07-05)

All ten backlog tasks (T1–T10) landed in an unattended build loop, one self-contained commit each
(see `docs/plans/tiers-1-3-autonomous.md` for the ledger). Gate on every commit: Biome clean,
typecheck 0 errors, `npm run test:all` green. Integration suite grew **19 → 42** over the run.

- **T1 — Cloudflare Images variants** (`d679d46`). `GET /api/photos/[id]/variant?size=thumb|md|lg`
  (320/1024/1600) transforms the R2 original to webp via `IMAGES`, long cache. Grid → thumb,
  viewer → lg; download stays raw.
- **T2 — Photo delete** (`8ccc2d2`). `DELETE /api/photos/[id]` (R2 delete + D1 batch over
  `exif_data`/`folder_photos`/`photos`, resilient to a missing object). Trash button + confirm
  dialog in the viewer, wired through `useLibrary`.
- **T3 — Server-side search + pagination** (`b6ad22b`). Rewrote `GET /api/photos` as a `buildFilter()`
  query builder: `q` (filename LIKE), `from`/`to` range, server `sort` (`newest|oldest|name`),
  `{ photos, total, limit, offset }` response. Client: debounced search + infinite scroll; removed
  client-side filter/sort. The backbone T4/T6/T7 extend.
- **T4 — Sort by image size** (`73c47bd`). Added `size_asc`/`size_desc` to the sort whitelist +
  "Largest"/"Smallest" dropdown options.
- **T5 — Multi-select → organize** (`2ba3a83`). Gallery selection model (toggle, shift-range,
  select-all, count) + contextual action bar: bulk add/remove-from-folder (folder endpoints already
  batched) and bulk delete behind a confirm.
- **T6 — Favorites** (`9aaff55`). Migration `0003` adds `photos.is_favorite`; `POST
  /api/photos/[id]/favorite` toggle; `?favorite=1` filter; heart toggle on tiles + viewer; sidebar
  Favorites view.
- **T7 — Tags** (`a9708cc`). Migration `0004` adds `tags` + `photo_tags` junction (cascading FKs);
  tag CRUD, attach/detach (DELETE via query param), `?tag=<id|name>` filter, `tag_ids` in rows;
  per-photo tag editor in the viewer + sidebar tag filter. Junction cleaned on photo/tag delete.
- **T8 — Upload page** (`1ee62b6`). `/upload` drag-and-drop page with per-file progress and a
  target-folder selector; extended `POST /api/photos` to accept `folderId` and assign membership
  server-side. Sidebar action now links to the page.
- **T9 — Map view** (`979ebdd`). Added `maplibre-gl`; `GET /api/photos/geo` returns geotagged rows;
  `/map` full-bleed MapLibre + OpenFreeMap (keyless) with thumb-variant markers → open the shared
  `PhotoViewer`; sidebar Map entry.
- **T10 — Dark mode** (`ddab967`). `@nuxtjs/color-mode` (`classSuffix: ''`, system default, no
  flash); 3-way light/system/dark toggle in the sidebar; full dark token audit retuned to the iris
  brand (background/glass/sidebar/aurora/borders/text); map basemap swaps light/dark reactively;
  `color-scheme` set for native controls.

**Known follow-up:** a pre-existing SSR hydration quirk (surfaced during T5) leaves the "All photos"
grid empty on first SSR load until a client-side query change — unrelated to the tasks above, worth
a fix pass. Tier 4 (provision + deploy, hardening) remains not started.

## Backlog — next features (2026-07-05)

Prioritized by impact × existing-plumbing. Tiers 1–3 are now **done** (see the section above); Tier 4
remains.

### Tier 1 — highest ROI, plumbing already exists

- **Cloudflare Images variants.** The `IMAGES` binding is declared and wrapped (`useImages`) but
  never used — `server/api/photos/[id]/raw.get.ts` serves full-size originals into every grid tile.
  Serve real `thumb`/`md`/`lg` variants transformed from R2; grid → thumb, viewer → lg, download →
  raw original. Biggest perf/UX win.
- **Photo delete.** No delete endpoint exists (upload/list/serve/move only). Add `DELETE
  /api/photos/[id]` → `BUCKET.delete(r2_key)` + D1 batch (`exif_data`, `folder_photos`, `photos`);
  wire a trash button + confirm into the viewer and gallery. Closes the obvious CRUD gap.

### Tier 2 — gallery maturity (finishes M5, starts M7)

- **Server-side search + pagination.** Current search is client-side, filename-only, over the
  already-fetched page (default 50). Add `GET /api/photos?q=&from=&to=&camera=&page=`; pager or
  infinite scroll; grid ⇄ list toggle.
- **Sort by image size.** Add file-size to the filters/sort dropdown (asc/desc) alongside the
  existing newest/oldest/name.
- **Multi-select + organize into folders.** Selection model on the gallery (click-to-select,
  shift-range, select-all); bulk action bar to add/remove the selected photos to/from folders in one
  request. Pairs naturally with the delete work (bulk delete).

### Tier 3 — new surfaces

- **Favorites / hearting.** Heart a photo (toggle endpoint + `photos.is_favorite` or a dedicated
  table); a "Favorites" entry under Library in the sidebar that filters the gallery to hearted
  photos.
- **Tags.** Free-form tags per photo (`tags` + `photo_tags` junction, many-to-many like folders);
  tag CRUD, per-photo tag editing in the viewer, filter/search by tag. Fulfils the M7 tagging goal.
- **Dedicated upload page.** Today the sidebar upload button just opens the file picker. Add a real
  `/upload` page: drag-and-drop dropzone, multi-file queue with per-file progress, and a
  target-folder selector so uploads land directly in a chosen folder.
- **Map view (EXIF GPS).** A `/map` view using **MapLibre GL** + **OpenFreeMap** tiles that plots
  photos with GPS coordinates as markers; click a marker → open that photo in the viewer. EXIF lat/
  lng is already extracted and stored (`exif_data.gps_latitude/longitude`), so the data is there.

### Tier 4 — make it real (M1 + M8)

- **Provision + deploy.** `database_id` is still `REPLACE_WITH_D1_DATABASE_ID`. Create remote D1/R2,
  enable Images, apply remote migrations, set secrets, first deploy + custom domain. Hold until the
  feature set feels done locally.
- **Hardening.** D1 Time Travel backups, R2 versioning, monitoring, export-everything job.
