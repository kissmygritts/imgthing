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

The shell reads as three stacked layers — use these when talking about depth:

- **Base plane** — the lowest level: the **aurora** gradient behind everything (see Brand &
  identity). Also called the root/base.
- **Shell planes** — the two peers that ride *directly* on the base plane, at the same level as
  each other (not stacked): the **sidebar** and the **glass panel**. Both are **floating glass
  cards using the identical `.glass-panel` material** (the sidebar's fill is aliased onto the panel's
  glass rules in `main.css`, so they never drift), inset with **even aurora gaps** around and between
  them — one consistent root padding, sidebar wrapper padding == panel margin. They differ only in
  layout (width/rounding), never material. *(Decided 2026-07-10. Supersedes the earlier model where
  the sidebar was a translucent base tint "part of the base" rather than a floating card.)*
- **Overlays** — everything that sits *above the whole shell* (both shell planes), each behind a
  dimming scrim: the **filters sheet**, the mobile sidebar sheet, the **viewer**, and the folder
  **dialogs**. The sheet/drawer overlays (filters sheet + viewer details drawer) share one **overlay
  glass** material (`.glass-overlay` in `main.css` — its own density, airier + blurrier than the
  shell planes, with a violet glow) and one **scrim** (`.glass-scrim` — a soft violet blur, not a
  black curtain), so they feel identical and can't drift. *(Layer-2 unified 2026-07-10.)*

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

## Filtering & scope

- **Scope** — which slice of the library the main view is anchored to before any filter narrows it
  further: current folder, Trash, or (via the calendar) a month scope. Navigational, set by the
  sidebar or calendar — never by a filter. Exactly one scope is active at a time.
- **Filter** — a facet that narrows what's shown *within* the current scope: tag, favorite,
  camera/lens, date range, visibility. Composable and live (no Apply step) — distinct from scope,
  which is exclusive and navigational.
- **Filters sheet** — the shadcn `Sheet` panel holding every filter facet, opened by the **Filters
  button** in the gallery toolbar (beside Select/Sort). Never call it "search" — the text search box
  is a separate, older surface in the sidebar and keeps that name.
