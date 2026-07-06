# Autonomous Build Plan — Feature Sprint (fix half-built + fill library gaps)

This file is **both the spec and the state store** for an unattended build loop, in the same shape
as `docs/plans/next-sprint-autonomous.md` (which drove S1–S6) and
`docs/plans/public-photos-plan.md` (P1–P9). A driver session (the "orchestrator") reads the ledger,
delegates the next `todo` task to a subagent, verifies the gate, commits, marks it `done`, and
repeats. It runs without human input **until it reaches the design-polish pass (F8), which is
intentionally reserved for the user** — the loop stops there and hands back.

Scope is the **autonomously-buildable subset** of the missing-features analysis: the one broken
half-feature plus the library gaps that need no external account and no product decision. Deploy,
backups-provisioning, video support, secret rotation, and album-level publishing are **out of
scope** here — see "Explicitly out of scope" for why each needs a human.

Point the loop at this file (see **How to run** at the bottom).

---

## Design summary (context for every task)

The local feature set is complete and the two prior sprints shipped. What remains splits into:

1. **One actively-broken feature** — the metadata edit drawer in `PhotoViewer` emits a `save` event
   that nothing listens to, and there is no `PATCH /api/photos/[id]` to persist it. Fixing this is
   F1 and comes first because it's misleading, not merely absent.
2. **Table-stakes library gaps** — bulk export (F3, doubles as the backup escape hatch),
   date/time-taken browsing (F2), and duplicate detection (F4).
3. **Discoverability / polish** — slideshow (F5), a keyboard-shortcut overlay (F6), and a storage
   readout (F7).

All the data these need already exists (`file_size`, `exif_data.taken_at`, the multi-select action
bar, `/api/photos/[id]/raw`); most tasks are aggregation + a param + a surface, mirroring patterns
already in the codebase (the camera/lens facets from S3, the Trash view from S1).

**Why F8 is reserved:** the new surfaces (date control, export affordance, slideshow chrome, help
overlay, duplicate hint, storage readout) are functional-but-plain out of the loop. Final visual
fit against **Bright Studio Glass** is a taste judgment tests can't gate and the user reviews
personally — same split as P7a/P7b. The loop runs everything **through F7**, then stops with the
features working end-to-end so the user can give design feedback from a live surface.

---

## Ground rules (apply to every task)

- **Branch:** commit directly to `main` (local-only repo — project convention).
- **One task = one feature commit.** Each task lands as a single, self-contained, cherry-pickable
  commit. Do **not** bundle two tasks. Do **not** leave a task half-committed.
- **Commit message format:** `<type>: <summary> [<task-id>]`, e.g.
  `feat: bulk zip export of selected photos [F3]`. The `[F#]` tag is how the loop and `git log`
  identify a task's commit — always include it. (This sprint uses `F#` ids so they never collide
  with the previous runs' `T#`/`S#`/`P#` tags in `git log`.)
- **Definition of Done (hard gate — all must pass before the feature commit):**
  1. `npm run check` (Biome) — auto-fixes formatting; must end clean (exit 0; the ~169 pre-existing
     warnings in generated `worker-configuration.d.ts` are not fatal and are not yours to fix).
  2. `npm run typecheck` — zero errors.
  3. `npm run test:all` — unit + integration suites green. (Integration runs `npm run build` first,
     so this is the slow gate; budget for it.)
  4. For any **new or changed server API endpoint**, add/extend an integration test under
     `test/integration/` mirroring the existing patterns (`import { env, SELF } from
     "cloudflare:test"`; helpers `login, pngBytes, url` from `./helpers`). New DB migrations must
     apply cleanly (`npm run db:migrate:local`).
  5. Manual/behavioral sanity is encouraged but the automated gate above is what blocks the commit.
- **Migrations:** additive only; next sequential number. The highest existing migration is
  `0007_login_throttle.sql`, so the **first** new one is `server/db/migrations/0008_*.sql` (only F4
  needs one). Never edit a prior migration. Run `npm run db:migrate:local` after adding one.
- **Design language:** match the existing "Bright Studio Glass" tokens and component patterns
  (`app/assets/css/main.css`, `app/components/ui/`, `docs/imgthing-ui.md`). Reuse shadcn/reka
  components already in `app/components/ui/`; **don't introduce a new UI kit or a date-picker/zip
  dependency without noting it in the ledger row**. Every new surface must be legible and operable
  at phone width (~375px) in **both** light and dark mode (the S6 mobile pass set this bar).
- **Security altitude:** the export endpoint (F3) and stats endpoint (F7) are owner-only — they live
  under `/api/**` so `server/middleware/auth.ts` guards them; never add a public/unauthenticated
  path to originals or aggregate data. Do not expose `r2_key` or raw EXIF in any new response.
- **Stay in scope.** Implement only the current task's spec. If you spot adjacent work, note it in
  the task's ledger row; don't do it.

---

## Loop protocol (the orchestrator follows this exactly, every iteration)

Each iteration does **one** task, then the loop fires again with fresh context. The heavy
implementation lives in a **subagent's** context so the orchestrator's context stays small.

1. **Sync state.** Read the **Task ledger** below and `git log --oneline -20`.
2. **Crash recovery.** If a task is marked `in_progress`:
   - If a commit tagged with its `[F#]` exists in `git log` → it actually finished; set it to `done`
     and continue.
   - Otherwise the prior attempt died mid-task → discard partial work (`git checkout . &&
     git clean -fd`), reset that task to `todo`, and treat it as the next task.
3. **Pick.** Choose the **first** task whose status is `todo`, in ledger order (top to bottom). The
   order is dependency-optimized — do not reorder. **Never pick a `hold` task** (that's F8, the
   human design pass).
4. **Claim.** Edit this file to set that task's status to `in_progress`. Commit just that ledger
   change: `chore: claim [F#]`. (No-repick guarantee, durable across restarts.)
5. **Delegate.** Spawn a **general-purpose subagent** with the task's full spec section pasted in,
   plus the Ground rules above. Instruct it to: implement to completion, satisfy the entire
   Definition of Done, and create the single feature commit with the `[F#]` tag. It must report
   back: commit SHA, what it changed, and gate results. **Do not read large implementation files
   yourself** — that's the subagent's job.
6. **Verify.** After the subagent returns, independently confirm the `[F#]` feature commit exists,
   and re-run the gate if the report is ambiguous (`npm run typecheck && npm run test:all`). Do
   **not** trust a claim of green without evidence in the transcript.
7. **Record.**
   - On success: set the task to `done`, append a one-line result note, commit `chore: mark [F#] done`.
   - On unresolvable failure: set the task to `blocked` with a one-line reason, commit
     `chore: block [F#] — <reason>`, and move on (don't halt the whole run for one task).
8. **Continue or stop.** If any `todo` tasks remain → let the loop fire again. If **no `todo`
   remains** (all `done`/`blocked`, with F8 still `hold`) → update `docs/PROGRESS.md` with a short
   summary of what landed, then **stop the loop and notify the user**: the feature sprint is
   functionally complete end-to-end and **F8 (design polish) is ready for their review**. Do not
   delegate or execute F8. Do not reschedule.

**Context hygiene:** the orchestrator keeps only the ledger + short per-task summaries in its head.
Never read large implementation files in the orchestrator — that's the subagent's job.

---

## Task ledger

Statuses: `todo` · `in_progress` · `done` · `blocked` · `hold` (human-only, never auto-picked).
Edit in place as the loop runs.

| #  | Task                                          | Status | Result note |
|----|-----------------------------------------------|--------|-------------|
| F1 | Fix metadata editing (`PATCH` + wire `save`)  | todo   | |
| F2 | Date / time-taken filtering                   | todo   | |
| F3 | Bulk download / export (zip)                  | todo   | |
| F4 | Duplicate detection on upload                 | todo   | |
| F5 | Slideshow mode                                | todo   | |
| F6 | Keyboard-shortcut help overlay                | todo   | |
| F7 | Storage-usage readout                         | todo   | |
| F8 | **Design polish — HUMAN, loop stops here**    | hold   | Awaiting user design review; never delegate |

**Why this order (dependencies):** **F1 first** — it's the only *broken* item (misleading UI), and
it's isolated (`[id]` route + viewer wiring). **F2** extends `buildFilter` in
`server/api/photos/index.get.ts` exactly like S3's camera/lens params — do the filter work while
that pattern is fresh; independent of the rest. **F3 (bulk export)** is the heaviest task (streaming
zip) — schedule it while context is clean; the multi-select action bar it hangs off already exists.
**F4** adds a migration and touches the **upload path** (`index.post.ts`) — grouped after the
serving/filter work so the schema is stable. **F5 (slideshow) before F6 (help overlay)** because
both edit `PhotoViewer`'s keydown handler and F6 must document the shortcut F5 adds — sequential
execution also avoids two tasks editing the same handler back-to-back. **F7 (storage readout)** is a
small isolated aggregation, last of the functional tasks. **F8 is human-only** and runs last so the
user reviews every new surface at once. Sequential execution keeps the one migration number
deterministic (F4 = `0008`).

---

## Task specs

Each subagent gets **one** of these sections. Specs are at spec-altitude — the subagent reads the
current code itself. Acceptance criteria are the contract. Key current-state facts are inlined so
the subagent doesn't have to rediscover them.

### F1 — Fix metadata editing (`PATCH /api/photos/[id]` + wire `save`)

**Goal:** the metadata edit drawer in `app/components/PhotoViewer.vue` is a dead end. It renders
editable EXIF fields and emits `save: [id, patch]` on save (see the `defineEmits` block, ~line 89,
whose own comment says *"No PATCH endpoint exists yet"*), but **`app/pages/index.vue` has no `@save`
handler** and there is **no server route** to persist it. Edits vanish. Make it real.

- **New endpoint `PATCH /api/photos/[id]/index.patch.ts`** (session-gated by the existing
  middleware). It accepts a JSON patch of the **editable** fields only. Read the drawer's field list
  (the "editable EXIF fields, in drawer order" array, ~line 289) and the `Photo` interface
  (~line 39) to get the exact keys — they are the EXIF text fields (`camera_make`, `camera_model`,
  `lens_info`, `exposure`, `aperture`, `focal_length`) plus numeric `iso`, and (if the drawer
  exposes it) `original_filename` for rename. `taken_at` and GPS are **display-only** — reject or
  ignore them; do not let the PATCH move a photo on the map.
  - Map EXIF keys to `exif_data` columns; **UPSERT** (a photo may have no `exif_data` row —
    `INSERT ... ON CONFLICT(photo_id) DO UPDATE`, or update-then-insert-if-zero-rows). `iso` is
    `INTEGER`; coerce/validate ("" → NULL). `original_filename`, if patched, updates the `photos`
    row; also bump `photos.updated_at = datetime('now')`.
  - 404 if the photo doesn't exist or is soft-deleted (`deleted_at IS NOT NULL`). Ignore unknown
    keys rather than 400 (forward-compatible with the client sending a wider `Partial<Photo>`).
  - Return the updated photo in the same shape the list/viewer already consume.
- **Client:** add an `updatePhoto(id, patch)` action to `app/composables/useLibrary.ts` mirroring
  `toggleFavorite` (single `$fetch` PATCH, then targeted `refreshNuxtData(["photos"])` or update the
  local row + toast). Wire `@save="updatePhoto"` on the `<PhotoViewer>` in `index.vue`. Confirm the
  drawer closes / reflects the saved values after success.

**Acceptance:** editing a caption/camera/lens field in the viewer and saving **persists** across a
reload; `iso` round-trips as a number; renaming updates `original_filename`; a soft-deleted photo
404s; `taken_at`/GPS cannot be changed; endpoint has happy-path + 404 + auth-guard + "unknown key
ignored" integration tests; gate green.

### F2 — Date / time-taken filtering

**Goal:** `exif_data.taken_at` is captured on upload and **indexed** (`idx_exif_taken_at` in
`0001_init.sql`) but you can't browse by it. Add a date-range filter, mirroring how S3 added
camera/lens params. **No migration, no EXIF work** — the `LEFT JOIN exif_data e` is already in the
shared query.

- **Filter params:** extend `buildFilter` in `server/api/photos/index.get.ts` with `dateFrom` and
  `dateTo`. `taken_at` is an ISO-ish TEXT string, so lexical comparison is chronological: add
  `if (q.dateFrom) conditions.push("e.taken_at >= ?")` and `<= ?` for `dateTo` (append a time
  component to `dateTo` or use `date(e.taken_at) <= date(?)` so an end date is inclusive of that
  whole day). Apply to **both** the COUNT and the paged SELECT. Photos with `taken_at IS NULL` fall
  out of a bounded range — that's correct (undated photos aren't "in" a date range); note it.
- **`useLibrary.ts`:** `dateFrom` / `dateTo` state + a `setDateRange(from, to)` action that clears
  the other exclusive views (folder/tag/favorite/camera/lens) the same way `selectTag` does, extend
  `currentTitle` (e.g. `"Jul 2025 – Aug 2025"`) and `refreshAll`. `index.vue`: add the
  `dateFrom`/`dateTo` params to `listQuery`.
- **UI:** a compact date-range control. To avoid pulling a calendar dependency, use **two native
  `<input type="date">`** fields styled with the existing `Input` tokens, in a small popover or a
  toolbar row (a "Date" `SidebarGroup` or a button in the gallery toolbar — pick whichever fits the
  existing sidebar/toolbar structure). A clear/reset affordance returns to "all". A fancier
  calendar/timeline scrubber is explicitly a **later** polish, not this task.

**Acceptance:** picking a from/to range filters the gallery server-side to photos taken in range;
the count reflects it; clearing returns to all; undated photos are excluded from a bounded range;
selecting a date range clears any active folder/tag/camera filter; the new params are
integration-tested (in-range included, out-of-range excluded, open-ended range); gate green.

### F3 — Bulk download / export (zip)

**Goal:** there's no way to get originals back out in bulk (per-photo download exists via
`/api/photos/[id]/raw`, wired in the viewer at ~line 840). Add a **streaming zip** export — the
single most-expected media-library feature, and the "export everything" escape hatch that doubles as
a backup. **Owner-only, under `/api`.**

- **New endpoint `GET /api/photos/export`** returning `application/zip`:
  - **Selection modes** (reuse the existing filter vocabulary): `?ids=a,b,c` for a multi-select
    export (follow the query-param convention the tags-detach DELETE and batch-delete already use —
    **not** a request body); and the current-view filters (`?all=1`, `?folderId=`, `?tag=`,
    `?favorite=1`, plus the F2 `dateFrom`/`dateTo` if trivial) for "export this view / everything".
    Always exclude soft-deleted rows.
  - **Stream, do not buffer.** Build the zip as a `ReadableStream` and pipe each R2 object body in
    sequentially — never load all originals into memory (originals are ≤25 MB each but a batch is
    unbounded). A small zero-dependency streaming-zip lib (e.g. `client-zip`, which takes async
    iterables of `{ name, input }` and yields a `ReadableStream`) is the clean path; **if you add a
    dependency, note it in the ledger row.** Store (no compression) is fine — JPEG/WebP are already
    compressed and streaming store avoids buffering for CRC/deflate.
  - Entry names: the original filenames, de-duplicated on collision (`name (2).jpg`). Response
    headers: `content-type: application/zip`, `content-disposition: attachment;
    filename="imgthing-export-<date>.zip"`.
  - **Cap** the selection (e.g. a max file count or total-byte ceiling as named constants) and return
    a clear `4xx` past it rather than starting an unbounded stream; document the cap.
- **Client:** add an **Export** action to the multi-select action bar in `index.vue` (next to bulk
  delete) that navigates to / fetches the export URL for the selected ids, and an "Export all" entry
  somewhere sensible (e.g. a menu). A download is simplest triggered by navigating to the GET URL
  (browser handles the save); if you use `fetch`, stream to a blob without holding the whole thing if
  avoidable. Show a toast / disabled state while it's building.

**Acceptance:** selecting several photos and choosing Export downloads a `.zip` whose entries are the
selected originals; "export all" includes every live photo; the response is `application/zip` with an
attachment disposition; the implementation streams from R2 (no full-batch buffering); over-cap
requests are rejected cleanly; integration test asserts `application/zip` + attachment header + a
non-empty body beginning with the `PK\x03\x04` zip signature (and, if a zip reader is readily
available, the expected entry count); gate green.

### F4 — Duplicate detection on upload

**Goal:** nothing stops the same photo being uploaded twice. Hash each upload and flag likely
duplicates so the user can notice. **Non-blocking** — the user may legitimately want a re-upload;
detection informs, it doesn't reject.

- **Migration `0008_content_hash.sql`:** `ALTER TABLE photos ADD COLUMN content_hash TEXT;` plus
  `CREATE INDEX idx_photos_content_hash ON photos (content_hash);`. Nullable — pre-existing rows and
  any upload where hashing fails stay NULL (no backfill needed; there's no deployed data, same
  reasoning as the variants self-heal).
- **Upload (`server/api/photos/index.post.ts`):** the file `bytes` (ArrayBuffer) are already in
  scope. Compute `crypto.subtle.digest("SHA-256", bytes)` → hex, store it in the insert. **Before**
  (or alongside) insert, `SELECT id, original_filename FROM photos WHERE content_hash = ? AND
  deleted_at IS NULL LIMIT 1`; if a match exists, still complete the upload but include
  `duplicateOf: { id, filename }` in that file's entry of the response. Keep it inside the existing
  per-file loop; keep the orphan-R2-cleanup-on-D1-failure path intact.
- **Upload UI (`app/pages/upload.vue`):** when a file's response carries `duplicateOf`, show a
  non-blocking per-file hint ("Looks like a duplicate of <filename>") alongside the existing
  success/failure treatment. Match the page's existing per-file status styling.
- **(Include if clean, else note as follow-up):** a **Duplicates** view — either a
  `GET /api/photos/duplicates` returning groups of live photos sharing a `content_hash`
  (HAVING COUNT(*) > 1), surfaced as a sidebar entry like Trash; or skip and leave a ledger note.
  The hash + upload-time report is the must-have.

**Acceptance:** uploading the same bytes twice succeeds both times, and the second response reports
`duplicateOf` pointing at the first; the upload page surfaces the hint; different images never
collide; migration applies; the changed upload endpoint keeps its existing tests green and adds a
duplicate-report test; gate green.

### F5 — Slideshow mode

**Goal:** a hands-off auto-advance through the current photo set, from the viewer. Small, isolated
to `app/components/PhotoViewer.vue`, reusing the existing next/prev nav.

- Add a **Play/Pause** control to the viewer action bar and an `s` keyboard shortcut that toggles
  slideshow. While playing, auto-advance to the next photo on an interval (e.g. 4s, a named
  constant) using the existing `next()`/`update:index` mechanism; stop at the end (or loop — pick
  one and keep it simple). **Pause on any manual nav / user interaction**, and exit on `Esc`.
- Respect `prefers-reduced-motion` (no crossfade if reduced; a plain cut is fine). Clean up the
  interval on unmount / close / when the viewer index changes externally — no leaked timers.
- Optionally dim/hide the drawer + chrome while playing for a cleaner show (functional placeholder;
  final look is F8). Don't fight the existing keydown handler — extend it.

**Acceptance:** pressing Play (or `s`) auto-advances through the open set at the interval; Pause and
manual nav stop it; `Esc` exits both slideshow and viewer sanely; no timer leaks (advancing keeps
working after several toggles); works on mobile; gate green.

### F6 — Keyboard-shortcut help overlay

**Goal:** the viewer has real shortcuts (`←`/`→` nav, `i` toggle details, `Esc` close, and after F5
`s` slideshow) but they're undiscoverable. Add a help overlay. Do this **after F5** so it documents
the full set.

- A `?` (Shift+/) shortcut and a small "?" / keyboard button in the viewer action bar open a
  **Dialog** (reuse `app/components/ui/dialog/`) listing every viewer shortcut with its key.
  **Enumerate from the actual keydown handler** in `PhotoViewer.vue` — don't hardcode a guessed list;
  it must stay truthful to the real bindings (include F5's `s`). Group as key → action rows with
  `<kbd>`-style treatment (functional placeholder styling; F8 refines).
- The overlay closes on `Esc`/`?`/backdrop and traps focus like the other dialogs. Ensure `?` while
  the overlay is open toggles it closed (don't stack).

**Acceptance:** pressing `?` in the viewer opens an overlay listing the real, current shortcuts
(including slideshow from F5); it opens/closes cleanly and doesn't interfere with the other
shortcuts; legible in light and dark at phone width; gate green.

### F7 — Storage-usage readout

**Goal:** show how much the library holds. `photos.file_size` (INTEGER, bytes) is populated on every
upload, so this is a pure aggregation + a small surface.

- **New endpoint `GET /api/photos/stats`** (owner-only): return
  `{ count, totalBytes }` from `SELECT COUNT(*) AS count, COALESCE(SUM(file_size),0) AS totalBytes
  FROM photos WHERE deleted_at IS NULL`, and (cheap, useful) a separate `{ trashedCount,
  trashedBytes }` for the tombstoned rows so the user can see what "empty trash" would reclaim. No
  `r2_key`, no per-photo data.
- **UI:** a compact readout in the sidebar footer (near the existing footer/theme area) or the app
  chrome: e.g. "1,240 photos · 8.6 GB". Add a tiny human-bytes formatter (B/KB/MB/GB) in
  `app/lib/utils.ts` if one doesn't exist. Fetch via `useFetch('/api/photos/stats', {key:'stats'})`
  and add `"stats"` to `refreshAll` so it updates after uploads/deletes.

**Acceptance:** the endpoint returns correct live count + summed bytes excluding trash, plus the
trashed figures; the UI shows a human-readable total that refreshes after an upload or delete; the
endpoint is integration-tested (counts/bytes correct, trash excluded from the live figure,
auth-guarded); gate green.

### F8 — Design polish pass (HUMAN — the loop stops before this)

**Not for a subagent.** After F7 lands, all new features work end-to-end and the user reviews the
live surfaces against Bright Studio Glass (`docs/imgthing-ui.md`) and gives design direction. Scope:
the date-range control (F2), the export affordance + progress treatment (F3), the duplicate hint
(F4), the slideshow chrome/transition (F5), the keyboard overlay's `<kbd>` styling (F6), and the
storage readout's placement/typography (F7) — plus overall on-brand fit in light and dark. The
orchestrator stops the loop when this is the only remaining task and notifies the user.

---

## Explicitly out of scope (needs a human — do NOT auto-pick or add)

- **Provision + deploy.** Needs the owner's Cloudflare account (`database_id` is still a
  placeholder). See `docs/cloudflare-setup.md`. Nothing here depends on it — these features are
  verified locally.
- **Backups (D1 Time Travel + R2 object versioning).** Provision-time account toggles, not code.
  F3's "export everything" is the code-side portion and is in scope; the infra side is not.
- **Video / non-image formats.** Upload is deliberately gated to `image/*`. Adding video is a
  product decision (which formats, thumbnailing, player) — not an unattended build.
- **Change-passphrase / secret-mutating settings.** The passphrase is a Worker secret (env), not
  runtime-mutable without KV/secret-rotation infra. Out of an autonomous loop.
- **Album / folder-level public publishing.** A security-sensitive extension of the public-token
  model (uniform 404s, GPS gating, token rotation) that deserves its **own** planned sprint with a
  design pass — not folded into a general feature sweep run unattended. Deferred in ADR 0005.
- **Image editing (crop/rotate/adjust)** and **AI/face tagging** — never scoped; out of character
  for a lightweight library.

---

## How to run

Start a self-paced loop pointed at this plan (no interval → the model paces itself, one task per
iteration):

```
/loop Follow docs/plans/features-sprint-autonomous.md. Execute the "Loop protocol" section exactly:
each iteration, sync the ledger + git log, run crash recovery, pick the first `todo` task (never a
`hold` task), claim it, delegate the full implementation to a general-purpose subagent (pasting that
task's spec + the Ground rules), verify the gate and the `[F#]` commit, then mark it `done` (or
`blocked` with a reason) and commit the ledger update. One task per iteration to keep context small.
When no `todo` tasks remain (F8 stays `hold`), update docs/PROGRESS.md, then STOP and tell me the
feature sprint is functionally complete and F8 (design polish) is ready for my review — do not
execute F8, do not reschedule. Run unattended through F7; do not ask for input before then.
```

Restart-safe: if interrupted, just start the loop again — it reconciles from the ledger + `git log`
and resumes at the next unfinished task. The loop will never auto-run F8.
