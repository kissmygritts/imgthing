# TODO

New feature, bug, and issue tracker. This is for anything we decide to wait on implementing or fixing. Very high level, stream of conciousness. Everything in here will need to be properly scoped or planned before implementing.

**Legend**

- **Label** — `Feature`, `Bug`, `Design`, `Docs`, `Chore`.
- **Effort** — `S` (a session), `M` (a day-ish, one plan), `L` (multi-plan, needs its own doc/ADR).
- **Human input** — how much taste/decision-making a human must supply before it can be built. Low = spec is unambiguous, safe to hand to an autonomous `/loop`. High = needs design taste, a product call, or external research first.

---

## Backlog

Ordered by ascending effort (the lowest-priority nice-to-have, backups, is parked at the bottom).
Most items still need a human design/product/research pass; the exception (bulk export) is noted
per-item.

### Feature: bulk download / export
- **Label:** Feature — select N → download a zip; also an "export everything" escape hatch (offline backup, no lock-in).
- **Effort:** M
- **Human input:** Low *(mostly technical; minor call on where the action lives in the UI)*
- **Description:** Let the owner get originals back out — a per-selection zip and a full-library export.
- **Implementation:** Streaming-zip in a Worker — stream objects from R2, **don't buffer** (memory ceiling). New endpoint; wire a bulk-bar action + an export entry in settings. Mind Worker CPU/time limits on large batches.

### Feature: multi-faceted search / filter
- **Label:** Feature — combine filters (camera, lens, tag, date, favorite, visibility) rather than a single date filter.
- **Effort:** L
- **Human input:** High *(design first — related to the reverted date filter)*
- **Description:** A real filter surface that composes multiple facets.
- **Implementation:** **Blocked on design.** Define the filter UX/tokens, then extend the list endpoint with composable filter params and mirror the state in `composables/useLibrary.ts`. Consider it the superset that the date view should slot into — worth one shared plan/ADR. The earlier single date filter (F2) was reverted specifically because the UI needed a redesign before rebuilding — see the F2 note in project memory / `docs/decisions`.

### Feature: calendar / date view
- **Label:** Feature — browse the library by calendar/date.
- **Effort:** L
- **Human input:** High *(design first — the prior date filter was reverted)*
- **Description:** A date-oriented way to navigate photos (month/day grid or timeline).
- **Implementation:** **Blocked on design.** Nail the interaction model at phone width first, then build. No date-picker dependency without flagging it (per CLAUDE.md). Backend can key on existing capture timestamps. Likely folds into the multi-faceted filter above.

### Feature: equipment / kit tracker (settings page)
- **Label:** Feature — record the gear I own/use.
- **Effort:** L
- **Human input:** High *(needs a gear data model + sourcing a public equipment list)*
- **Description:** Add and track owned equipment. Not required to inform camera/lens filters, but nice alongside them.
- **Implementation:** New additive migration for an `equipment` table + CRUD endpoints + settings UI (settings shell already ships). Open question the user flagged: is there a public list of cameras/lenses to seed autocomplete from? Research that before building the input UX.

### Feature: album / folder-level publishing
- **Label:** Feature — publish a whole folder as one public gallery.
- **Effort:** L
- **Human input:** High *(security-sensitive; needs a design pass + its own ADR)*
- **Description:** Extend the per-photo public-token model to a folder-level token so an entire folder shares as a single gallery.
- **Implementation:** **Blocked on design.** Deferred in [ADR 0005](./decisions/0005-precomputed-variants-from-r2.md) — deserves its own planned sprint. Reuse the tokened serving model (`server/routes/p/[token]/**`) at folder granularity; hold the uniform-bare-404 and no-EXIF/GPS invariants.

### Chore: platform-level backups (lowest priority — nice to have)
- **Label:** Chore — durability; the layer beneath soft-delete/trash (covers account-/platform-level loss, not accidental deletion, which trash already handles).
- **Effort:** S
- **Human input:** Low *(no code; needs Cloudflare dashboard access)*
- **Priority:** Lowest. Nice-to-have, not blocking. Negligible cost for a single-owner library — don't get nagged about it.
- **Description:** Two independent layers, both effectively free:
  - **D1 Time Travel — already on.** Not a toggle: D1 keeps 30 days of history automatically, no extra charge. This is a *restore procedure to know*, not a setting to enable — `wrangler d1 time-travel restore` (or a bookmark) recovers point-in-time metadata.
  - **R2 object versioning — the only thing to actually turn on.** Free to enable; you pay only for retained old bytes at the normal storage rate (~$0.015/GB-month, egress free). imgthing's R2 is mostly write-once (variants only rewrite on a self-heal miss), so churn is low.
- **Implementation:** Enable R2 versioning in the dashboard, then **add a lifecycle rule to expire noncurrent versions** after ~30 days — without it, purged bytes accumulate forever. No migration, no app code. See [ADR 0006](./decisions/0006-production-deploy-and-operations.md).
- **Caveat (changes an invariant):** with versioning on, purge / empty-trash no longer immediately reclaims R2 bytes — the delete adds a marker and keeps the prior version, so a purged original stays recoverable for the lifecycle window. That's the point (it's the account-level safety net), but it softens the current "purge frees storage" invariant for that window.

---

## Done

- ~~Logo & wordplate~~ — shipped: focus-screen mark (`AppLogo` component) + mono wordmark, from the
  Nikon split-prism focusing screen. Chosen from a rendered bake-off; see ADR 0007 and `CONTEXT.md`.

- ~~Show photo location on the photo details panel~~ — shipped in `1bf597e` (location map in photo details view).
- ~~Infinite scroll / pagination~~ — already implemented in `app/pages/index.vue` (`IntersectionObserver` sentinel + `loadMore`, `offset` paging); `/api/photos` already supports `limit`/`offset`. Discovered during loop planning 2026-07-07.
- ~~Mobile menu transparency (Bug)~~ — shipped `96ef4c9` (opaque glass surface for mobile nav drawer).
- ~~Use all EXIF data, not just camera settings~~ — shipped `4511961` (full EXIF detail in photo viewer).
- ~~Settings section (shell + user-menu entry)~~ — shipped `c0797e4` (settings route + sidebar entry).
- ~~Storage & cloud-usage metrics (settings page)~~ — shipped `6b1b72a` (`GET /api/settings/usage` + stat cards).
- ~~Raw database viewer (settings page)~~ — shipped `b413d1f` (read-only allow-listed table browser).
- ~~Bulk actions on multi-select~~ — shipped `4031825` (batch favorite/publish/tag on the existing bulk bar).
- ~~In-app API documentation~~ — shipped 2026-07-07 as OpenAPI route annotations (`defineRouteMeta` on every `server/api/**` handler) + Nitro's dev-only spec/Scalar UI (`/_openapi.json`, `/_scalar`), enforced by `test/unit/openapiMeta.test.ts`. Pivoted from the planned hand-authored page to generation from source; kept dev-only (not published).
