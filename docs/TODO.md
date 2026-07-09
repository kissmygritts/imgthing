# TODO

New feature, bug, and issue tracker. This is for anything we decide to wait on implementing or fixing. Very high level, stream of conciousness. Everything in here will need to be properly scoped or planned before implementing.

**Legend**

- **Label** — `Feature`, `Bug`, `Design`, `Docs`, `Chore`.
- **Effort** — `S` (a session), `M` (a day-ish, one plan), `L` (multi-plan, needs its own doc/ADR).
- **Human input** — how much taste/decision-making a human must supply before it can be built. Low = spec is unambiguous, safe to hand to an autonomous `/loop`. High = needs design taste, a product call, or external research first.

---

## Backlog

Everything remaining needs a human design/product/research pass first — none are loop-ready as written.
Ordered by ascending effort.

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
