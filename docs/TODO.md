# TODO

New feature, bug, and issue tracker. This is for anything we decide to wait on implementing or fixing. Very high level, stream of conciousness. Everything in here will need to be properly scoped or planned before implementing.

**Legend**

- **Label** — `Feature`, `Bug`, `Design`, `Docs`, `Chore`.
- **Effort** — `S` (a session), `M` (a day-ish, one plan), `L` (multi-plan, needs its own doc/ADR).
- **Human input** — how much taste/decision-making a human must supply before it can be built. Low = spec is unambiguous, safe to hand to an autonomous `/loop`. High = needs design taste, a product call, or external research first.

---

## Backlog (ordered by ascending human input — top items are loop-ready)

### 1. Bug: mobile menu transparency
- **Label:** Bug — mobile nav menu renders transparent / invisible in local dev.
- **Effort:** S
- **Human input:** Low
- **Description:** The mobile slide-out menu has a broken/absent background so content shows through and it's unreadable.
- **Implementation:** Trace the mobile menu component (nav/sidebar overlay in `app/`), find the missing glass-panel background token, and apply the Bright Studio Glass surface (`app/assets/css/main.css`). Verify at ~375px in both light and dark. Likely a missing `backdrop-blur`/`bg-*` on the overlay or a z-index/stacking issue.

### 2. Feature: use all EXIF data, not just camera settings
- **Label:** Feature — surface the full EXIF payload in the photo details panel.
- **Effort:** M
- **Human input:** Low
- **Description:** Today only camera settings (ISO/shutter/aperture/etc.) are shown. We already parse and store richer EXIF; expose the rest (lens, dimensions, software, timestamps, color profile, GPS where allowed).
- **Implementation:** Check what `server/utils/exif.ts` extracts vs. what's persisted in `other_data`. Extend the details panel to render the remaining fields grouped sensibly. **Keep the public/GPS invariant** — public `meta` only emits GPS when `show_location = 1`; never leak raw `other_data` or GPS on public routes. Additive migration only if new columns are wanted (next number after `0008`).

### 3. Feature: storage & cloud-usage metrics (settings page)
- **Label:** Feature — settings page showing real Cloudflare usage, not just `SUM(photos)`.
- **Effort:** M
- **Human input:** Low
- **Description:** Show R2 bytes stored (originals + variants), object counts, D1 row counts, and rough cost accounting.
- **Implementation:** Aggregate D1 counts + summed byte sizes; enumerate R2 (originals + the three variant objects per photo) for true stored bytes. New session-gated `GET /api/settings/usage` (+ integration test). Render as stat cards in the settings shell (depends on #7). Cost accounting can start as static per-GB constants.

### 4. Feature: raw database viewer (settings page)
- **Label:** Feature — Supabase-style read-only table browser for the D1 data.
- **Effort:** M
- **Human input:** Low
- **Description:** A dev-facing page to inspect raw rows (photos, tags, etc.) without a separate DB client.
- **Implementation:** Session-gated `GET /api/settings/db/:table` returning paginated rows for an **allow-listed** set of tables (never arbitrary SQL). Render in a scrollable table using existing `app/components/ui/` primitives. Read-only. Add integration test. Depends on #7.

### 5. Feature: bulk actions on multi-select
- **Label:** Feature — extend multi-select to make-public, delete, add-to-folder, favorite, tag.
- **Effort:** M
- **Human input:** Low-Medium *(needs the "folder" concept defined if that action is in scope)*
- **Description:** Selection mode exists but the action set is thin. Add batch publish/unpublish, batch delete, batch favorite/tag.
- **Implementation:** Reuse the single-item mutations already in `composables/useLibrary.ts`; add batch variants that call batch endpoints. **DELETE takes ids via query string (`?ids=a,b,c`), never a body.** Follow the existing batch-delete / tags-detach convention. Integration tests per endpoint. "Add to folder" is blocked on there being a folder model — split it out if folders don't exist yet.

### 7. Feature: settings section (shell + user-menu entry)
- **Label:** Feature — settings pages reachable from the user menu in the sidebar.
- **Effort:** M
- **Human input:** Low *(structure)* / High *(the "default settings" page — see #8)*
- **Description:** The container/nav for all settings sub-pages (#3, #4, #8, #9). A settings layout + routing + sidebar entry point.
- **Implementation:** New `app/pages/settings/` route(s) with a sub-nav, linked from the user menu. Build the shell first as the dependency for the data-driven settings pages (#3, #4) which are low-input; defer the taste-heavy ones. Single-owner app — no per-user scoping.

### 8. Feature: in-app API documentation
- **Label:** Feature / Docs — browsable route reference with example responses inside the app.
- **Effort:** M
- **Human input:** Medium *(decide format: hand-authored vs. generated)*
- **Description:** A page listing the API routes, methods, params, and example responses.
- **Implementation:** Simplest first pass is a hand-authored data structure describing `server/api/**` rendered to a page. A generated approach (introspecting routes/handlers) is more work and can come later. Keep it session-gated; don't expose the public share routes' internals.

### 9. Feature: calendar / date view
- **Label:** Feature — browse the library by calendar/date.
- **Effort:** L
- **Human input:** High *(design first — the prior date filter was reverted)*
- **Description:** A date-oriented way to navigate photos (month/day grid or timeline).
- **Implementation:** **Blocked on design.** The earlier date-filter attempt (F2) was reverted specifically because the UI needed a redesign before rebuilding — see the F2 note in project memory / `docs/decisions`. Nail the interaction model at phone width first, then build. No date-picker dependency without flagging it (per CLAUDE.md). Backend can key on existing capture timestamps.

### 10. Feature: multi-faceted search / filter
- **Label:** Feature — combine filters (camera, lens, tag, date, favorite, visibility) rather than a single date filter.
- **Effort:** L
- **Human input:** High *(design first — related to the reverted date filter)*
- **Description:** A real filter surface that composes multiple facets.
- **Implementation:** **Blocked on design** (same lesson as #9). Define the filter UX/tokens, then extend the list endpoint with composable filter params and mirror the state in `composables/useLibrary.ts`. Consider it the superset that #5 pagination and #9 date view should slot into — worth one shared plan/ADR.

### 11. Feature: equipment / kit tracker (settings page)
- **Label:** Feature — record the gear I own/use.
- **Effort:** L
- **Human input:** High *(needs a gear data model + sourcing a public equipment list)*
- **Description:** Add and track owned equipment. Not required to inform camera/lens filters, but nice alongside them.
- **Implementation:** New additive migration for an `equipment` table + CRUD endpoints + settings UI (depends on #7). Open question the user flagged: is there a public list of cameras/lenses to seed autocomplete from? Research that before building the input UX.

### 12. Design: logo & wordplate
- **Label:** Design — improve the logo and wordmark.
- **Effort:** M
- **Human input:** High *(pure taste)*
- **Description:** Current logo/wordplate needs work.
- **Implementation:** Design exploration, not an autonomous task. Reference/idea from the user: the **Nikon split-image (split-prism) focusing screen** — https://jerkwithacamera.com/nikon-df-split-screen-manual-focusing-screen/comment-page-1/ — as a motif for the mark. Produce concepts for human review; only the final SVG/asset swap is a code task.

---

## `/loop` batches

Grouped so each batch is self-contained and low enough on human input to hand to an autonomous `/loop`. Run top-to-bottom; later batches depend on earlier ones.

**Batch 1 — Fixes & mechanical wins** ✅ *done*
- [x] #1 mobile menu transparency (Bug)
- [x] #2 all EXIF data (Feature)

**Batch 2 — Settings shell + data pages** *(low input; #7 unblocks #3/#4)*
- #7 settings shell + user-menu entry
- #3 storage/usage metrics
- #4 raw database viewer

**Batch 3 — Gallery UX** *(low input)*
- #5 bulk multi-select actions — extend the *existing* bulk bar (folder add/remove + soft-delete already ship) with batch favorite / publish / unpublish / tag

**Batch 4 — Docs** ✅ *done*
- [x] #8 in-app API documentation

> Per-batch execution plans live in `docs/plans/loops/`.

**Not loop-eligible — needs a human design/product/research pass first**
- #9 calendar/date view — redesign before rebuilding (F2 was reverted)
- #10 multi-faceted search — design; likely the superset for #5/#9 (own ADR)
- #11 equipment tracker — data model + external gear-list research
- #12 logo & wordplate — pure taste

---

## Done

- ~~Show photo location on the photo details panel~~ — shipped in `1bf597e` (location map in photo details view).
- ~~Infinite scroll / pagination~~ — already implemented in `app/pages/index.vue` (`IntersectionObserver` sentinel + `loadMore`, `offset` paging); `/api/photos` already supports `limit`/`offset`. Discovered during loop planning 2026-07-07.
- ~~#8 in-app API documentation~~ — shipped 2026-07-07 as OpenAPI route annotations (`defineRouteMeta` on every `server/api/**` handler) + Nitro's dev-only spec/Scalar UI (`/_openapi.json`, `/_scalar`), enforced by `test/unit/openapiMeta.test.ts`. Pivoted from the planned hand-authored page to generation from source; kept dev-only (not published). See `docs/plans/loops/loop-4-docs.md`.
