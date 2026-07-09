# ADR 0007 — Brand identity: the focus-screen mark

**Status:** Accepted · 2026-07 — implemented in the logo/wordplate task (TODO "Design: logo &
wordplate"). Replaces the interim "aurora iris ring" mark (the `.brand-mark` conic-gradient span)
and the serif-italic wordmark. Design was chosen from a rendered bake-off; the visual language of
[the imgthing-ui skill](../../.claude/skills/imgthing-ui/SKILL.md) (Bright Studio Glass — aurora +
`.prism-edge`) carries over unchanged and constrains the palette here.

## Context

The app shipped with a placeholder identity: a soft conic-gradient disc (`.brand-mark`, an
"aperture / iris ring") next to `imgthing` in Georgia italic. Neither said anything about the
product — the disc was an aperture, not a photographic *idea*, and the serif italic was a default
editorial choice. The owner wanted a mark grounded in the craft of photography.

The reference the owner supplied and then sketched: the **Nikon split-image (split-prism) focusing
screen** — the circular viewfinder spot where an out-of-focus subject sits visibly *offset* until
focus snaps the halves into alignment. It is the single most photographer-legible symbol of
*focus*, and "img" + "thing" is a plain-spoken, tool-ish name that a technical mark suits.

The design question: **translate the focusing screen into a mark that lives in the existing aurora
palette, reads at 16px, and carries the focus idea even when static.**

## Decision

**A focus-screen mark**, built as an SVG Vue component (`app/components/AppLogo.vue`), paired with a
**monospace wordmark**. Chosen over three other bake-off directions (a sheared aurora iris, an
aurora-quadrant "cross split", and a minimal `+`) after rendering all of them at size on light and
dark aurora.

### The mark

- **Geometry** (traced from the owner's prototype sketch): two **bracket wings** — each a short
  horizontal bar top and bottom joined by a gently **bowed outer edge** — flanking a **circle drawn
  as its upper and lower arcs only** (the left/right of the ring is omitted so the wings read as
  separate elements, with a real gap between them and the circle). The **split spot** cut by the
  horizontal **split bar** sits in the clear centre. Iterations along the way: a full focusing ring
  around the spot (too cluttered) and a four-arc "soft rounded frame" (lost the bracket feel and
  crowded the circle) — both discarded for this bracket-plus-arcs reading. `full` is the framed mark;
  `simple` is a single **split circle + bar** (no frame) for tight spaces / the favicon.
- **Colour** — everything is ink via `currentColor` (so the mark inherits the theme's foreground
  and needs no dark-mode variant), and **only the split bar carries the aurora gradient**
  (`#ffcca6 → #d3aeff → #9ccdff → #8fe3c4`, the same four-stop aurora as `.prism-edge`). One accent,
  quiet everywhere else — "the light passing through the prism."
- **Rests out of focus** — the spot's two halves sit offset across the bar at rest and snap into
  alignment on hover (`interactive`). The offset is in SVG **user units**, so it scales down with
  the mark: visible at hero/sidebar size, sub-pixel (effectively aligned) at favicon size. This is
  why the favicon needs no separate "focused" artwork. `prefers-reduced-motion` drops the transition.

### The wordmark

- Lowercase `imgthing` in the existing **`--font-mono` stack** — the app's "instrument voice"
  (EXIF values, byte counts, D1 table names all render mono). No new font dependency; the system
  mono stack is accepted (rendering varies slightly per OS, fine for a single-owner app).

### Where it renders

`AppLogo` is the **single source** — sidebar header (`:size="24"`), login card (`:size="34"`), and
the styleguide brand sample. Hand-rolling the wordmark is disallowed (skill rule).

### Favicon

- `public/favicon.svg` (the `simple` cut — a single split circle + aurora bar) is the primary icon,
  wired ahead of the legacy `favicon.ico` fallback in `app/app.vue`. The SVG swaps its ink stroke via
  an internal `@media (prefers-color-scheme: dark)` so it reads on both light and dark browser chrome;
  the aurora bar (bright) reads on both. Rendered in focus (aligned) for cleanliness at tab size.

## Consequences

**Gained:**
- A mark that *means something* — focus, the core act of photography — and reuses the aurora
  palette so it belongs to Bright Studio Glass rather than sitting beside it.
- Theme-adaptive for free (`currentColor` + one gradient); no `.dark` variant to maintain.
- One component, one favicon file; the old unlayered `.brand-mark` CSS rule is deleted.

**Accepted trade-offs:**
- **SVG-only favicon** (no regenerated `.ico`, no `apple-touch-icon.png`). Modern browsers use the
  SVG; very old ones fall back to the stale `.ico`. Acceptable for a modern single-user app; the
  PNG/ICO pipeline can be added later (`sharp` is available for rasterizing).
- **System mono wordmark** is not pixel-identical across devices. A self-hosted face (e.g. JetBrains
  Mono woff2) would fix that at the cost of a font asset — deferred per the no-new-dependency rule.
- The **resting-out-of-focus** default is a deliberate "is it broken?" risk; mitigated by the
  offset scaling to sub-pixel at small sizes and snapping to aligned on hover.
