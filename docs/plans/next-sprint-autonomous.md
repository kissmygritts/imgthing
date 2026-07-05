# Autonomous Build Plan — Next Sprint (Safety + Durability + Polish)

This file is **both the spec and the state store** for an unattended build loop, exactly like
`tiers-1-3-autonomous.md` (which drove T1–T10 to completion). A driver session (the
"orchestrator") reads the ledger, implements the next `todo` task via a subagent, commits it, marks
it `done`, and repeats until every task is `done` or `blocked`. It runs without human input.

Scope is a **deliberate subset** of the next sprint in `docs/PROGRESS.md`: soft delete/trash, batch
delete, integration-test coverage, camera/lens filters, upload limits, and a mobile/responsive pass.
The remaining PROGRESS items (deploy, brute-force protection, backups, bulk export) are **out of
scope** here — they need more human planning and are intentionally excluded.

Point the loop at this file (see **How to run** at the bottom).

---

## Ground rules (apply to every task)

- **Branch:** commit directly to `main` (local-only repo — project convention).
- **One task = one feature commit.** Each task lands as a single, self-contained, cherry-pickable
  commit. Do **not** bundle two tasks. Do **not** leave a task half-committed.
- **Commit message format:** `<type>: <summary> [<task-id>]` e.g.
  `feat: soft-delete tombstone + Trash view [S1]`. The `[S#]` tag is how the loop and `git log`
  identify which task a commit belongs to — always include it. (This sprint uses `S#` ids so they
  never collide with the previous run's `T#` tags in `git log`.)
- **Definition of Done (hard gate — all must pass before the feature commit):**
  1. `npm run check` (Biome) — auto-fixes formatting; must end clean.
  2. `npm run typecheck` — zero errors.
  3. `npm run test:all` — unit + integration suites green. (Integration runs `npm run build` first,
     so this is the slow gate; budget for it.)
  4. For any **new or changed server API endpoint**, add/extend an integration test under
     `test/integration/` mirroring the existing `photos.test.ts` / `folders.test.ts` patterns
     (`import { env, SELF } from "cloudflare:test"`; helpers `login, pngBytes, url` from
     `./helpers`). New DB migrations must apply cleanly (`npm run db:migrate:local`).
  5. Manual/behavioral sanity is encouraged but the automated gate above is what blocks the commit.
- **Migrations:** additive only; next sequential number. The highest existing migration is
  `0004_tags.sql`, so the **first** new one is `server/db/migrations/0005_*.sql`. Never edit a prior
  migration. Run `npm run db:migrate:local` after adding one.
- **Design language:** match the existing "Bright Studio Glass" tokens and component patterns
  (`app/assets/css/main.css`, `app/components/ui/`, `docs/imgthing-ui.md`). Reuse shadcn/reka
  components already in `app/components/ui/`; don't introduce a new UI kit. New surfaces must be
  legible in **both** light and dark mode (dark mode shipped in T10).
- **Stay in scope.** Implement only the current task's spec. If you spot adjacent work, note it in
  the task's ledger row, don't do it.

---

## Loop protocol (the orchestrator follows this exactly, every iteration)

Each iteration does **one** task, then the loop fires again with fresh context. The heavy
implementation lives in a **subagent's** context so the orchestrator's context stays small and
doesn't drift across the whole run.

1. **Sync state.** Read the **Task ledger** below and `git log --oneline -20`.
2. **Crash recovery.** If a task is marked `in_progress`:
   - If a commit tagged with its `[S#]` exists in `git log` → it actually finished; set it to `done`
     and continue.
   - Otherwise the prior attempt died mid-task → discard partial work
     (`git checkout . && git clean -fd`), reset that task to `todo`, and treat it as the next task.
3. **Pick.** Choose the **first** task whose status is `todo`, in ledger order (top to bottom). The
   order is dependency-optimized — do not reorder.
4. **Claim.** Edit this file to set that task's status to `in_progress`. Commit just that ledger
   change: `chore: claim [S#]`. (No-repick guarantee — a claimed/done task is never picked again.)
5. **Delegate.** Spawn a subagent (general-purpose) with the task's full spec section pasted in, plus
   the Ground rules above. Instruct it to: implement to completion, satisfy the entire Definition of
   Done, and create the single feature commit with the `[S#]` tag. It must report back: commit SHA,
   what it changed, and gate results. **Do not read large implementation files yourself** — that's
   the subagent's job.
6. **Verify.** After the subagent returns, independently confirm the `[S#]` feature commit exists,
   and re-run the gate if the report is ambiguous (`npm run typecheck && npm run test:all`). Do
   **not** trust a claim of green without evidence in the transcript.
7. **Record.**
   - On success: set the task to `done`, append a one-line result note, commit `chore: mark [S#] done`.
   - On unresolved failure: set the task to `blocked` with a one-line reason, commit
     `chore: block [S#] — <reason>`, and move on (do not halt the whole run for one task).
8. **Continue or stop.** If any `todo` tasks remain → let the loop fire again. If **none** remain
   (all `done`/`blocked`) → update `docs/PROGRESS.md` with a short summary of what landed, then
   **stop the loop** (do not reschedule).

**Context hygiene:** keep only the ledger + short per-task summaries in the orchestrator's head.
Never read implementation files in the orchestrator. If context is getting heavy, a task wasn't
delegated cleanly.

---

## Task ledger

Statuses: `todo` · `in_progress` · `done` · `blocked`. Edit in place as the loop runs.

| #  | Task                                   | Status | Result note |
|----|----------------------------------------|--------|-------------|
| S1 | Soft delete / trash                    | done   | 139da58 — tombstone+Trash view+restore+purge/empty-trash; geo & list exclude tombstones; trash.test.ts added |
| S2 | Batch delete endpoint                  | done   | ecf3a49 — DELETE /api/photos single-write soft-delete (?ids=, ?purge=1); bulkDelete now one request; tests added |
| S3 | Camera & lens filters                  | in_progress |             |
| S4 | Upload limits                          | todo   |             |
| S5 | Integration-test coverage audit        | todo   |             |
| S6 | Mobile / responsive pass               | todo   |             |

**Why this order (dependencies):** **S1 is the backbone** — it adds `photos.deleted_at`, converts
the delete endpoint from hard-delete to a tombstone, and adds `deleted_at IS NULL` to the shared
query in `server/api/photos/index.get.ts`. Every later list/filter task must build on that filtered
query, so it goes first. **S2 (batch delete)** must land after S1 so batch delete tombstones (soft)
instead of hard-deleting — it reuses S1's semantics and purge path. **S3 (camera/lens)** extends the
same `buildFilter` S1 just touched — cleaner to layer on afterward than to have two tasks edit
`index.get.ts` back-to-back. **S4 (upload limits)** is isolated to `POST /api/photos`. **S5** is a
coverage audit that runs after the endpoint-adding tasks so it can see all new routes. **S6
(mobile pass) is dead last on purpose** — it audits *every* surface, so all new surfaces (the Trash
view from S1, the camera/lens sidebar sections from S3) must exist first, or they'd need
re-auditing. Sequential execution keeps migration numbers deterministic (S1 = `0005`).

---

## Task specs

Each subagent gets **one** of these sections. Specs are at spec-altitude — the subagent reads the
current code itself. Acceptance criteria are the contract. Key current-state facts are inlined so the
subagent doesn't have to rediscover them.

### S1 — Soft delete / trash

**Goal:** deletes are currently **permanent** (`DELETE /api/photos/[id]` in
`server/api/photos/[id]/index.delete.ts` drops the R2 object then D1-batch-deletes `exif_data` →
`folder_photos` → `photo_tags` → `photos`). That's the worst failure mode for a photo library.
Move to a `deleted_at` tombstone + a Trash view + restore, and only purge R2/D1 on
permanent-delete / empty-trash.

- **Migration `0005_*.sql`:** add `photos.deleted_at TEXT` (nullable; ISO timestamp, `NULL` = live).
  Index it (`CREATE INDEX ... ON photos(deleted_at)`).
- **Convert `DELETE /api/photos/[id]`** to a **soft delete**: set `deleted_at = <now>` instead of
  hard-deleting. Keep 404 for a missing row; still return `{ ok: true }`. Do **not** touch R2 or the
  child rows here anymore.
- **Restore:** `POST /api/photos/[id]/restore` → clears `deleted_at` (back to live). 404 if missing.
- **Permanent delete / purge** (this is where the *old* hard-delete logic moves):
  - `DELETE /api/photos/[id]?purge=1` — permanently removes one tombstoned photo (R2 object +
    the same D1 batch as the old endpoint). Optionally only allow purge on already-tombstoned rows.
  - `DELETE /api/photos/trash` — **empty trash**: permanently remove *all* tombstoned photos (R2
    deletes + D1 batch for each). Resilient to already-missing R2 bytes (the old code already
    `.catch(() => {})`s the R2 delete — preserve that).
- **Exclude tombstones from every normal listing.** In `server/api/photos/index.get.ts`, `buildFilter`
  must add `p.deleted_at IS NULL` by default (in **both** the COUNT and the paged SELECT). Add a
  `?deleted=1` param that flips it to `p.deleted_at IS NOT NULL` (the Trash view). Also confirm the
  geo endpoint (`server/api/photos/geo*`) excludes tombstones.
- **UI:**
  - A **Trash** entry under "Library" in `AppSidebar.vue` (lucide `Trash2` icon), wired through
    `useLibrary.ts` with the same exclusive-select pattern as Favorites (`selectTrash()` that clears
    folder/tag/favorites and drives `?deleted=1`). Extend `currentTitle` ("Trash").
  - In the Trash view, each tile / the viewer shows **Restore** and **Delete forever** (the latter
    behind the existing confirm dialog). An **Empty trash** action for the whole view.
  - The normal delete button keeps its current confirm dialog but its copy should now read like
    "move to Trash" (recoverable), not permanent.
  - Route all of it through `useLibrary.ts` (it already owns `deletePhoto`/`bulkDelete`, favorite
    toggle, tag mutations — mirror that structure; call `refreshAll()` or targeted
    `refreshNuxtData(["photos"])` after mutations).

**Acceptance:** deleting a photo moves it to Trash (still in R2/D1, hidden from all normal views);
Trash view lists tombstoned photos; restore brings one back; delete-forever and empty-trash actually
purge R2 + all D1 rows (no orphans); default listings and geo exclude tombstones; migration applies;
new/changed endpoints integration-tested; gate green.

### S2 — Batch delete endpoint

**Goal:** bulk delete currently fires **N parallel** per-photo requests. `useLibrary.ts`
`bulkDelete(photoIds)` does `Promise.all(ids.map(id => $fetch('DELETE /api/photos/'+id)))` — partial
failure leaves mixed state, and there's no collection-level endpoint. Add one batch route and a
single D1 write.

- **New endpoint `DELETE /api/photos`** (collection level — there is none today, only `[id]`). It
  takes a list of ids and performs **one** operation.
  - **Pass ids via the query string** (e.g. `?ids=a,b,c`), **not** a request body — this codebase
    has a documented Workers "DELETE-with-body" issue and already uses query params for the
    tags-detach DELETE. Follow that convention.
  - **Semantics must match S1:** this is a **soft** delete — set `deleted_at = <now>` for all given
    ids in a single D1 statement/batch (`UPDATE photos SET deleted_at=? WHERE id IN (...)`). Do not
    hard-delete. Return a count / the affected ids. Ignore ids that don't exist (idempotent).
  - (Optional, if trivial and it composes with S1's purge: accept `?purge=1` to batch-permanent-delete
    tombstoned ids. Only if clean — otherwise leave permanent-delete to S1's empty-trash.)
- **Client:** rewrite `bulkDelete` in `useLibrary.ts` to call the single batch endpoint instead of N
  fetches, then one `refreshAll()` + one toast. Keep the select-mode action bar + confirm dialog in
  `index.vue` working unchanged from the caller's side.

**Acceptance:** selecting several photos and deleting sends **one** request; all are tombstoned in a
single D1 write; the grid updates; no partial-failure mixed state; endpoint integration-tested
(happy path + unknown ids ignored + auth guard); gate green. (Depends on S1 for soft-delete
semantics.)

### S3 — Camera & lens filters

**Goal:** *filter images by camera, lens, or a camera+lens combination.* The EXIF already exists —
`exif_data.camera_model` and `exif_data.lens_info` are populated on upload (both defined in
`0001_init.sql`), and `server/api/photos/index.get.ts` **already `LEFT JOIN exif_data e`** in both
its COUNT and SELECT. So this is **aggregation + two filter params + sidebar UI — no migration, no
EXIF work.**

- **Aggregation routes**, modeled on `server/api/tags/index.get.ts`:
  - `GET /api/cameras` → `SELECT camera_model AS name, COUNT(*) AS photo_count FROM exif_data
    WHERE camera_model IS NOT NULL GROUP BY camera_model ORDER BY photo_count DESC` (or by name).
  - `GET /api/lenses` → same over `lens_info`.
  - These count **live** photos only — join/filter so tombstoned photos (S1's `deleted_at`) don't
    inflate the counts. (JOIN `photos p ON p.id = e.photo_id AND p.deleted_at IS NULL`.)
- **Filter params:** extend `buildFilter` in `server/api/photos/index.get.ts` with `camera` and
  `lens`. The `e` alias is already in scope — add `if (q.camera) conditions.push("e.camera_model = ?")`
  and the lens equivalent (slot in after the existing `tag` block). Supporting both at once yields the
  camera+lens combination **for free**.
- **`useLibrary.ts`:** keyed fetches for the two lists (`useFetch('/api/cameras', {key:'cameras'})`,
  likewise lenses); `selectedCamera` / `selectedLens` state with exclusive `selectCamera` /
  `selectLens` actions (clear-other-views-then-set, exactly like `selectTag`); extend `currentTitle`
  and `refreshAll` (add `"cameras","lenses"` to the refresh keys). Then in `index.vue`'s photo-list
  query (`listQuery`), add `else if` branches that pass `camera`/`lens`.
- **`AppSidebar.vue`:** two new `SidebarGroup`s ("Cameras", "Lenses") reusing `<SidebarEntry>` exactly
  like the Tags group loops it (props `icon, label, count, active`, emits `select`). Lucide
  `Camera` / `Aperture` (or similar) icons.

**Acceptance:** the sidebar lists cameras and lenses with counts; selecting a camera filters the
gallery server-side; selecting a lens filters; selecting one then the other combines
(camera AND lens); counts exclude trashed photos; new endpoints integration-tested; gate green.
(Depends on S1 so the `deleted_at` filter is already present in the shared query.)

### S4 — Upload limits

**Goal:** `POST /api/photos` (`server/api/photos/index.post.ts`) reads **each file fully into an
ArrayBuffer** with **no** max size, no max count, no total-bytes cap — a large batch can pressure
Worker memory. Add guards.

- Add per-file **max size** (pick a sane default, e.g. 25 MB — tune to taste, define as a named
  constant), a **max file count** per request (e.g. 50), and optionally a **total-bytes** cap for the
  batch. Reject over-limit files/requests with a clear `4xx` (413 Payload Too Large or 400) and a
  message naming the offending file and the limit — don't silently drop.
- Decide the partial-batch policy and make it explicit: either reject the whole request if any file
  is over-limit, or accept the valid ones and report per-file rejections in the response. Prefer the
  latter (mirrors how the upload page already surfaces mixed success/failure per file), but keep it
  simple.
- Keep the existing behavior otherwise: multipart parse via `readMultipartFormData`, the optional
  `folderId` text part, EXIF extraction, and the orphan-R2-cleanup-on-D1-failure path.
- Surface limits gracefully in the upload UI (`app/pages/upload.vue`) if cheap — at minimum the
  server rejection must produce a readable per-file error, not an unhandled 500.

**Acceptance:** uploading an over-size file is rejected with a clear error (no 500, no OOM risk);
too many files in one request is rejected; within-limit uploads still work end-to-end with folder
assignment; the endpoint's new guards are integration-tested (over-size rejected, over-count
rejected, valid upload still succeeds); gate green.

### S5 — Integration-test coverage audit

**Goal:** ensure the test suite covers every endpoint, closing any real gaps. **Important
correction to the sprint doc:** the routes PROGRESS.md listed as untested — favorite toggle,
`variant`, photo delete, `geo`, upload-with-`folderId` — are **already covered** in
`test/integration/photos.test.ts`. So this task is a **verification + gap-fill**, not a from-scratch
effort. Do not re-add tests that already exist.

- **Audit:** enumerate every route under `server/api/` and cross-check against the existing test
  files (`auth`, `folders`, `health`, `tags`, `photos`). Produce the list of genuinely-untested or
  under-tested endpoints. By the time this task runs, S1–S4 should each have added their own tests
  (per the Definition of Done), so the real gaps should be small — but verify rather than assume.
- **Fill the gaps** you find, following the existing patterns (`SELF.fetch(url(...))` with a `cookie`
  from `login()`, `pngBytes()` for image bodies). Prioritize: soft-delete/restore/purge/empty-trash
  (S1), batch delete (S2), camera/lens aggregation + filter (S3), upload limits (S4) — confirm each
  has happy-path + error-path (404 / bad input / auth-guard) coverage. Add edge cases that matter:
  e.g. a tombstoned photo does **not** appear in the default list or geo, restore makes it reappear,
  empty-trash leaves no orphan rows.
- If you find a **bug** while writing a test (a route that doesn't behave as its spec says), note it
  in the ledger result and fix it only if trivial and in-scope; otherwise leave the failing case as
  a documented `blocked` note — do not silently skip.

**Acceptance:** every server route has at least happy-path + one error-path integration test; the
S1–S4 endpoints are covered as above; `npm run test:all` green with the new tests; no pre-existing
test regressed; gate green.

### S6 — Mobile / responsive pass

**Goal:** make the whole app comfortable on a phone. The baseline plumbing exists — `default.vue`
uses `SidebarProvider` + offcanvas `AppSidebar` + a `SidebarTrigger` (mobile hamburger, `md:hidden`),
and the gallery grid is already responsive (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4
xl:grid-cols-5`). So this is an **audit-and-fix pass**, not a rebuild. Go surface by surface at a
narrow viewport (~375px) and fix what breaks.

- **Known weak spots to check first:** the select-mode **bulk-action bar** in `index.vue`
  (fixed/floating bar) and the confirm **dialogs** — verify they fit and are tappable on small
  screens. The **PhotoViewer** overlay (image + metadata panel + action buttons) — ensure it's
  usable on a phone (panel shouldn't crowd the image off-screen; buttons reachable).
- **Every surface** must be legible and operable at phone width in **both light and dark mode**:
  gallery, viewer, folders tree, favorites, tags, the **Trash view (S1)**, the **Cameras/Lenses
  sidebar sections (S3)**, upload page, map. Tap targets ≥ ~40px; no horizontal overflow; text not
  clipped; the offcanvas sidebar opens/closes cleanly and nav selections close it on mobile.
- Use Tailwind responsive utilities and the existing Bright Studio Glass tokens — **don't** restyle
  desktop, only add mobile breakpoints where needed. Prefer `sm:`/`md:` progressive enhancement.
- Verify visually across the main routes at a narrow viewport (use the run/verify skill / browser
  tools). Screenshots or a short note per surface in the ledger result help.

**Acceptance:** at ~375px width, every route is usable — no horizontal scroll, no clipped controls,
the action bar and dialogs fit, the viewer is operable, the sidebar toggles cleanly — in both light
and dark mode; desktop layout unchanged; gate green. (Runs last so all S1/S3 surfaces exist.)

---

## How to run

Start a self-paced loop pointed at this plan (no interval → the model paces itself, one task per
iteration):

```
/loop Follow docs/plans/next-sprint-autonomous.md. Execute the "Loop protocol" section exactly: each
iteration, sync the ledger, run crash recovery, pick the first `todo` task, claim it, delegate the
full implementation to a general-purpose subagent (pasting that task's spec + the Ground rules),
verify the gate and the `[S#]` commit, then mark it `done` (or `blocked` with a reason) and commit
the ledger update. One task per iteration to keep context small. When no `todo` tasks remain, update
docs/PROGRESS.md and stop the loop — do not reschedule. Run fully unattended; do not ask for input.
```

Restart-safe: if interrupted, just start the loop again — it reconciles from the ledger + `git log`
and resumes at the next unfinished task.
