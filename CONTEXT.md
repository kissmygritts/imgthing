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
