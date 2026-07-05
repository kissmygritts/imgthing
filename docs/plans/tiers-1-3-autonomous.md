# Autonomous Build Plan — Backlog Tiers 1–3

This file is **both the spec and the state store** for an unattended build loop. A driver session
(the "orchestrator") reads the ledger, implements the next `todo` task via a subagent, commits it,
marks it `done`, and repeats until every task is `done` or `blocked`. It runs without human input.

Point the loop at this file (see **How to run** at the bottom).

---

## Ground rules (apply to every task)

- **Branch:** commit directly to `main` (this is a local-only repo — see project convention).
- **One task = one feature commit.** Each task lands as a single, self-contained, cherry-pickable
  commit. Do **not** bundle two tasks in one commit. Do **not** leave a task half-committed.
- **Commit message format:** `<type>: <summary> [<task-id>]` e.g.
  `feat: Cloudflare Images variants for grid + viewer [T1]`. The `[T#]` tag is how the loop and
  `git log` identify which task a commit belongs to — always include it.
- **Definition of Done (hard gate — all must pass before the feature commit):**
  1. `npm run check` (Biome) — auto-fixes formatting; must end clean.
  2. `npm run typecheck` — zero errors.
  3. `npm run test:all` — unit + integration suites green. (Integration runs `npm run build` first,
     so this is the slow gate; budget for it.)
  4. For any **new or changed server API endpoint**, add/extend an integration test under
     `test/integration/` mirroring the existing `photos.test.ts` / `folders.test.ts` patterns. New
     DB migrations must apply cleanly (`npm run db:migrate:local`).
  5. Manual/behavioral sanity is encouraged but the automated gate above is what blocks the commit.
- **Migrations:** additive only; next sequential number (`000N_*.sql`) in
  `server/db/migrations/`. Never edit a prior migration. Run `npm run db:migrate:local` after
  adding one.
- **Design language:** match the existing "Bright Studio Glass" tokens and component patterns
  (`app/assets/css/main.css`, `app/components/ui/`, `docs/imgthing-ui.md`). Reuse shadcn/reka
  components already in `app/components/ui/`; don't introduce a new UI kit.
- **Stay in scope.** Implement only the current task's spec. If you spot adjacent work, note it in
  the task's ledger row, don't do it.

---

## Loop protocol (the orchestrator follows this exactly, every iteration)

Each iteration does **one** task, then the loop fires again with fresh context. This is deliberate:
the heavy implementation lives in a **subagent's** context, so the orchestrator's context stays
small and doesn't drift across the whole run.

1. **Sync state.** Read the **Task ledger** below and `git log --oneline -20`.
2. **Crash recovery.** If a task is marked `in_progress`:
   - If a commit tagged with its `[T#]` exists in `git log` → the task actually finished; set it to
     `done` and continue.
   - Otherwise the prior attempt died mid-task → discard any partial work
     (`git checkout . && git clean -fd`), reset that task to `todo`, and treat it as the next task.
3. **Pick.** Choose the **first** task whose status is `todo`, in ledger order (top to bottom). The
   order is already dependency-optimized — do not reorder.
4. **Claim.** Edit this file to set that task's status to `in_progress`. Commit just that ledger
   change: `chore: claim [T#]`. (This is the no-repick guarantee — a claimed/done task is never
   picked again, and the commit makes the claim durable across restarts.)
5. **Delegate.** Spawn a subagent (general-purpose) with the task's full spec section pasted in,
   plus the Ground rules above. Instruct it to: implement to completion, satisfy the entire
   Definition of Done, and create the single feature commit with the `[T#]` tag. It must report
   back: commit SHA, what it changed, and gate results.
6. **Verify.** After the subagent returns, independently confirm: the `[T#]` feature commit exists,
   and re-run the gate if the subagent's report is ambiguous (`npm run typecheck && npm run
   test:all`). Do **not** trust a claim of green without evidence in the transcript.
7. **Record.**
   - On success: set the task to `done` in the ledger, append a one-line result note, and commit
     `chore: mark [T#] done`.
   - On failure the subagent couldn't resolve: set the task to `blocked` with a one-line reason,
     commit `chore: block [T#] — <reason>`, and move on (do not halt the whole run for one task).
8. **Continue or stop.** If any `todo` tasks remain → let the loop fire again for the next one. If
   **none** remain (all `done`/`blocked`) → update `docs/PROGRESS.md` with a short summary of what
   landed, then **stop the loop** (do not reschedule).

**Context hygiene:** the orchestrator should keep only the ledger + short per-task summaries in its
head. Never read large implementation files in the orchestrator — that's the subagent's job. If the
orchestrator's context is getting heavy, it's a sign a task wasn't delegated cleanly.

---

## Task ledger

Statuses: `todo` · `in_progress` · `done` · `blocked`. Edit in place as the loop runs.

| #  | Task                                   | Status | Result note |
|----|----------------------------------------|--------|-------------|
| T1 | Cloudflare Images variants             | in_progress |             |
| T2 | Photo delete                           | todo   |             |
| T3 | Server-side search + pagination        | todo   |             |
| T4 | Sort by image size                     | todo   |             |
| T5 | Multi-select → organize into folders   | todo   |             |
| T6 | Favorites / hearting                   | todo   |             |
| T7 | Tags                                   | todo   |             |
| T8 | Dedicated upload page (drag-and-drop)  | todo   |             |
| T9 | Map view (MapLibre + OpenFreeMap)      | todo   |             |
| T10| Dark mode (initial pass)               | todo   |             |

**Why this order (efficiency / dependencies):** T1–T2 are isolated Tier-1 wins with no schema
churn. T3 rebuilds `GET /api/photos` into a real server-side query (search + paging + server sort) —
it is the **backbone** that T4/T6/T7 all extend, so it must land before them. T4 then adds `size` as
one more server sort option (clean extension, no rework). T5 adds a gallery selection model. T6/T7
add schema + filters on top of the T3 query builder. T8/T9 are mostly-new standalone pages and go
last (T9 pulls a new dependency). **T10 (dark mode) is dead last on purpose** — it themes every
surface, so all surfaces (including the T8 upload page and T9 map view) must exist first, or they'd
need re-theming afterward. Sequential execution means migration numbers stay deterministic and no
two tasks touch `index.vue` / `useLibrary.ts` / `/api/photos` at the same time.

---

## Task specs

Each subagent gets **one** of these sections. Specs are at spec-altitude: the subagent reads the
current code itself. Acceptance criteria are the contract.

### T1 — Cloudflare Images variants

**Goal:** stop serving full-size originals into every grid tile and the lightbox. Serve resized
variants via the already-declared `IMAGES` binding (works in local dev — the miniflare emulation
supports `width`/`height`/`format`, which is all we need; no deploy required).

- New endpoint: `GET /api/photos/[id]/variant?size=thumb|md|lg`. Loads the R2 original, runs
  `IMAGES.input(body).transform({ width }).output({ format: 'image/webp' })`, streams the result
  with a long `Cache-Control`. Sizes: `thumb`≈320, `md`≈1024, `lg`≈1600 (tune to taste). Unknown
  size → 400; missing photo → 404.
- `raw.get.ts` stays as-is (full original) and remains what the **download** link uses.
- Grid tiles (`app/pages/index.vue`) → `thumb`. Photo viewer (`app/components/PhotoViewer.vue`)
  main image → `lg`; download stays `raw`.
- Reuse `useImages` from `server/utils/cloudflare.ts`.

**Acceptance:** grid requests small webp variants (verify in devtools/network via the run/verify
skill or a quick fetch), viewer shows `lg`, download still yields the byte-original; endpoint tested
in `test/integration/`; gate green.

### T2 — Photo delete

**Goal:** full delete of a photo (currently missing — you can upload/list/serve/move but not
delete).

- New endpoint: `DELETE /api/photos/[id]`. Order: delete R2 object (`BUCKET.delete(r2_key)`), then a
  D1 batch removing `exif_data`, `folder_photos`, and the `photos` row. 404 if not found. Make it
  resilient: if the R2 object is already gone, still clean up D1.
- UI: a delete/trash button in `PhotoViewer.vue` (and optionally a per-tile action in the gallery)
  behind a shadcn confirm dialog (`AlertDialog` if present, else `Dialog`). On success: toast,
  close the viewer, refresh the list (`refreshNuxtData(["photos"])`), advance nav sensibly.
- Wire the action through `useLibrary.ts` to match how folder mutations are structured.

**Acceptance:** deleting removes R2 + all D1 rows (no orphans), UI updates without reload, confirm
dialog gates it; endpoint integration-tested; gate green.

### T3 — Server-side search + pagination

**Goal:** replace the client-side, filename-only, single-fetch list with a real server query. This
is the backbone T4/T6/T7 extend.

- Extend `GET /api/photos` with query params: `q` (filename LIKE), `from`/`to` (taken_at or
  uploaded_at date range), `sort` (`newest|oldest|name`, server-side), plus existing
  `folderId`/`limit`/`offset`. Keep the response shape (rows with EXIF + `folder_ids`) and add total
  count for paging. Preserve existing `folderId=none` semantics.
- Client (`index.vue` + `useLibrary.ts`): move search & sort to drive the query (debounced search
  input); add pagination — **infinite scroll** preferred (IntersectionObserver via
  `@vueuse/core`), pager acceptable. Remove the now-redundant client-side filter/sort.
- Keep the empty/filtered states working.

**Acceptance:** typing search hits the server and pages correctly; sort is server-side; large
libraries don't fetch everything at once; endpoint tested (search + range + paging); gate green.

### T4 — Sort by image size

**Goal:** add `size` to the sort options.

- Server: extend T3's `sort` param with `size_asc` / `size_desc` (order by `photos.file_size`).
- Client: add the two options to the sort dropdown in `index.vue` with clear labels
  (e.g. "Largest", "Smallest").

**Acceptance:** selecting a size sort reorders server-side, both directions; gate green.
(Depends on T3 — the sort is server-side by then.)

### T5 — Multi-select → organize into folders

**Goal:** select multiple photos in the gallery and bulk-organize them.

- Selection model in `index.vue`: click-to-toggle select mode, shift-click range, select-all/clear,
  a selection count. Keep it out of the way when nothing is selected (contextual action bar).
- Bulk action bar: **add to folder** / **remove from folder** for all selected, and (reusing T2)
  **bulk delete** behind a confirm.
- Prefer bulk endpoints: extend `POST /api/folders/[id]/photos` /
  `DELETE /api/folders/[id]/photos` to accept many `photoIds` (they may already — verify), or add a
  batch route. Avoid N sequential requests.
- Route state through `useLibrary.ts`.

**Acceptance:** select several photos, add them to a folder in one action, remove in one action,
bulk-delete with confirm; membership reflects immediately; gate green.

### T6 — Favorites / hearting

**Goal:** heart a photo and browse favorites.

- Migration: add `photos.is_favorite INTEGER NOT NULL DEFAULT 0` (simplest) — or a `favorites`
  table if you prefer; column is fine for single-owner.
- Endpoint: `POST /api/photos/[id]/favorite` toggle (or `PUT` with a boolean). Return the new state.
- `GET /api/photos`: include `is_favorite` in rows; support `?favorite=1` filter (extends T3's query
  builder).
- UI: heart toggle in `PhotoViewer.vue` and on gallery tiles (hover); a **Favorites** entry under
  "Library" in `AppSidebar.vue` that filters the gallery to favorited photos.

**Acceptance:** toggling persists and reflects everywhere; the Favorites sidebar view filters
correctly; toggle endpoint tested; migration applies; gate green.

### T7 — Tags

**Goal:** free-form tags per photo (fulfils the M7 tagging goal).

- Migration: `tags` (id, name unique) + `photo_tags` junction (many-to-many, cascading FKs), mirror
  the `folder_photos` design.
- Endpoints: list/create tags (`GET/POST /api/tags`), attach/detach on a photo
  (`POST /api/photos/[id]/tags`, `DELETE .../tags?tagIds=` — use query for DELETE, per the
  documented Workers DELETE-with-body issue), and `?tag=<id|name>` filter on `GET /api/photos`
  (extends T3).
- UI: per-photo tag editor in `PhotoViewer.vue` (add/remove, autocomplete from existing tags);
  tags shown on the photo; filter the gallery by tag (sidebar section or the search bar).
- Include `tag` membership in list rows (GROUP_CONCAT like `folder_ids`).

**Acceptance:** create a tag, attach/detach on a photo, filter gallery by tag; junction cleaned on
photo delete (T2) and tag delete; endpoints tested; migrations apply; gate green.

### T8 — Dedicated upload page (drag-and-drop)

**Goal:** replace the sidebar "button that opens a file picker" flow with a real upload surface.

- New page `app/pages/upload.vue`: a drop zone (drag-and-drop + click-to-browse), a multi-file
  queue showing each file with per-file progress/status, and a **target-folder selector** so uploads
  land directly in a chosen folder. Reuse the existing upload path (`POST /api/photos`) and folder
  membership (`POST /api/folders/[id]/photos`) — or extend the upload endpoint to accept a
  `folderId` and assign membership server-side (cleaner; prefer this).
- Sidebar: point the upload action at `/upload` (keep or retire the quick-picker button — link to
  the page).
- Handle many files, mixed success/failure per file, and non-image rejection gracefully.

**Acceptance:** drag several images onto the page, pick a target folder, upload with visible
per-file progress, and they appear in that folder; server-side folder assignment tested if added;
gate green.

### T9 — Map view (MapLibre + OpenFreeMap)

**Goal:** plot geotagged photos on a map. EXIF lat/lng is already extracted into
`exif_data.gps_latitude/gps_longitude`, so the data exists.

- Add dependency `maplibre-gl`. Use **OpenFreeMap** tiles (free, no key — e.g. the `liberty` style
  at `https://tiles.openfreemap.org/styles/liberty`). Import the maplibre CSS.
- New page `app/pages/map.vue`: full-bleed map, markers for every photo with GPS. Fetch coordinates
  from a lightweight endpoint (extend `GET /api/photos` with `?hasGps=1` returning id + lat/lng +
  thumb, or add `GET /api/photos/geo`). Cluster if trivial; otherwise plain markers are fine.
- Click a marker → open that photo in the existing `PhotoViewer` (reuse the component). Popup with
  the `thumb` variant (T1) is a nice touch.
- Add a **Map** entry to the sidebar nav.

**Acceptance:** geotagged photos appear at the right locations, clicking a marker opens the viewer,
tiles load from OpenFreeMap (works in local dev — it's a public tile server); no API key committed;
gate green. If no photos have GPS in the local DB, verify with a seeded/geotagged test image.

---

### T10 — Dark mode (initial pass)

**Goal:** a working light/dark toggle. Groundwork already exists — `app/assets/css/main.css` has a
`.dark { … }` token block (line ~102), the `@custom-variant dark (&:is(.dark *))` directive, and
dark-specific aurora tweaks. What's missing is anything that **applies** the `.dark` class: there's
no color-mode module, no `useColorMode`, no persistence, no toggle UI. This task wires that up and
completes the dark token set — it is not a from-scratch redesign.

- **Toggle mechanism (SSR-safe):** prefer `@nuxtjs/color-mode` (Nuxt-native — handles the SSR class,
  system-preference default, and no flash-of-wrong-theme via its inline script; `classSuffix: ''`
  so it toggles `.dark` to match the existing variant). Acceptable alternative: `useColorMode` from
  `@vueuse/core` (already a dependency) — but if you use it, you **must** prevent the SSR
  flash-of-unstyled-theme (inline head script setting the class before paint). Persist the choice
  and honor `prefers-color-scheme` on first visit.
- **Toggle UI:** a light/dark (and ideally "system") switch in `AppSidebar.vue`, styled with the
  existing shadcn components and Bright Studio Glass tokens. Use a lucide sun/moon icon.
- **Complete the token audit:** go through every custom token and surface — `--background`,
  glass panels, `--sidebar`, prism edge, aurora blobs, borders, text/ink, muted, accents — and make
  sure each has a correct `.dark` value so dark mode looks intentional, not just an inverted
  background. The aurora already has dark tweaks; verify they read well. Set `color-scheme` so
  native form controls/scrollbars match.
- **Scope:** "initial pass" = the toggle works, persists, no flash, and every existing surface
  (gallery, viewer, folders, favorites, tags, upload page, map) is legible and on-brand in dark. Fine
  detail polish can come in a later design pass.

**Acceptance:** toggling flips the whole app between light and dark and persists across reloads;
first visit respects system preference; no flash-of-wrong-theme on SSR load; every surface is
legible in both modes; gate green. Verify visually across the main routes (use the run/verify
skill).

## How to run

Start a self-paced loop pointed at this plan (no interval → the model paces itself, one task per
iteration):

```
/loop Follow docs/plans/tiers-1-3-autonomous.md. Execute the "Loop protocol" section exactly: each
iteration, sync the ledger, run crash recovery, pick the first `todo` task, claim it, delegate the
full implementation to a general-purpose subagent (pasting that task's spec + the Ground rules),
verify the gate and the `[T#]` commit, then mark it `done` (or `blocked` with a reason) and commit
the ledger update. One task per iteration to keep context small. When no `todo` tasks remain, update
docs/PROGRESS.md and stop the loop — do not reschedule. Run fully unattended; do not ask for input.
```

Restart-safe: if interrupted, just start the loop again — it reconciles from the ledger + `git log`
and resumes at the next unfinished task.
