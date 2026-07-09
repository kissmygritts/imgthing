# Context — imgthing glossary

The shared language of imgthing. Terms only — no implementation detail.

## Brand & identity

- **Mark** — the standalone symbol/glyph. Today an aurora *iris/aperture ring*
  (`.brand-mark`); being redesigned around the split-prism motif.
- **Wordmark** — the set typographic treatment of the name "imgthing": lowercase, in the
  `--font-mono` stack (the app's "instrument voice"), locked up beside the focus-screen mark.
  Rendered only via the `AppLogo` component — never hand-rolled.
- **Focus-screen mark** — the chosen mark direction (supersedes the aurora iris ring): two
  **bracket wings** (short horizontal bars + a bowed outer edge) flanking a **circle shown as its
  upper and lower arcs only**, with a clear gap between wings and circle; a **split spot** cut by a
  horizontal bar sits in the clear centre. The bar catches the aurora gradient (only accent);
  everything else is ink (`currentColor`). The spot rests slightly *out of focus* (halves offset
  across the bar) and snaps into alignment on hover/focus. Lives in the `AppLogo` component; the
  `simple` variant (single split circle + bar) is the favicon.
- **Wordplate** — the mark + wordmark **locked together** as one unit (the lockup). The
  reusable brand signature that appears in the sidebar header, favicon (mark alone), etc.
- **Split-prism motif** — visual reference for the mark redesign: the Nikon split-image
  (split-prism) focusing screen. The reference the owner likes is a **cross-split** (plus-
  shaped) prism: a central circular focusing spot with a bright metallic "+" prism where
  vertical subject lines shear across the horizontal cut and horizontal lines shear across
  the vertical cut — offset until focus snaps them into alignment. Secondary elements: a
  small rounded **AF/metering square** off to one side and a soft **outer rounded-rectangle**
  screen frame.
- **Aurora** — the app's ambient conic/radial gradient (peach → lilac → blue → mint) that
  the mark and the `.prism-edge` signature rim both draw their color from.

## Layout & surfaces

The two-plane shell: an aurora root plane behind everything, with a floating glass panel riding
over it. Names below are the canonical vocabulary — use them; don't invent synonyms.

- **Glass panel** — the floating, inset, rounded glass plane that rides over the aurora and holds
  everything the user works in (`SidebarInset`, class `glass-panel`, in `layouts/default.vue`). The
  main content surface.
- **Main view** — whatever the glass panel currently holds: the **gallery view** (`index.vue`), the
  **map view** (`map.vue`), or the **calendar view** (`calendar.vue`). Use "main view" for the content
  region, "glass panel" for the surface itself.
- **Calendar view** — the `/calendar` route: a date-first *navigation* surface (not a filter). It shows
  the **months overview** — one **month row** per month that has photos — and tapping a row enters
  the gallery **scoped to that month**. Two levels only (Months → the existing All-photos grid); no
  Years level and no per-day mosaic.
- **Month row** — a dense list row standing for one month in the months overview: the month label +
  photo count on the left, a **thumb strip** (a short run of that month's thumbnails) on the right.
  Chosen over a photo-wall hero card for scannability at phone width. Tapping the row navigates to the
  gallery month-scoped.
- **Thumb strip** — the horizontal run of thumbnails inside a month row.
- **Month scope** — the gallery's active date-range view when entered from a month card: the grid
  constrained to one calendar month (a half-open `[month-start, next-month-start)` range over the
  capture date). The gallery **title** reads the month (e.g. "July 2026").
- **Sidebar** — the leftmost nav panel (`AppSidebar.vue`, on the shadcn `Sidebar` primitive):
  folders, tags, cameras/lenses, favorites, trash, search. Offcanvas on phones. Never call it a
  "drawer" — that word is reserved for the viewer (see below).
- **User menu** — the dropdown at the bottom of the sidebar (`SidebarFooter`): the storage readout
  plus settings/logout.
- **Viewer** (a.k.a. **photo viewer**) — the whole full-screen `PhotoViewer.vue` overlay opened
  from a gallery tile. Composed of two halves:
  - **Image stage** — the full-bleed image layer + frosted backdrop (the lightbox half).
  - **Details drawer** — the glass `<aside>` that slides in from the right with EXIF / edit / share
    (toggled by `drawerOpen`, the `i` key, or "Details"). It's a drawer, not a shadcn `Sheet`.
    "Drawer" always means this — never the sidebar.
