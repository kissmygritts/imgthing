# imgthing UI — Bright Studio Glass

The gallery's visual design language. Chosen in Milestone 6 via a three-way design bakeoff
(dark Vision-Pro vs. bright aurora vs. editorial); the bright aurora direction won, with the
editorial lightbox layout grafted in.

**One-line intent:** a bright, calm, Apple-style glassmorphism — a subtly drifting *aurora*
behind the whole app, a translucent sidebar that sits *on* it, and the content floating *above*
it in a rounded glass panel.

All of it is light-mode. **Dark mode still uses the old blue tokens and has not been restyled** —
see [Known gaps](#known-gaps).

---

## Where it lives

| Concern | File |
| --- | --- |
| Tokens, aurora, glass, prism (source of truth) | `app/assets/css/main.css` |
| Aurora element + two-plane shell | `app/layouts/default.vue` |
| Root-plane chrome (brand, search, upload, nav) | `app/components/AppSidebar.vue` |
| Gallery toolbar + glass tiles | `app/pages/index.vue` |
| Lightbox (plate viewer) | `app/components/PhotoViewer.vue` |

> **CSS layering gotcha:** the `.aurora`, `.glass-panel`, `.prism-edge`, and `.brand-mark` rules
> live **outside `@layer`** on purpose. Unlayered rules beat Tailwind's layered utilities, so
> `.glass-panel`'s background wins over a component's own `bg-background`. Keep them unlayered.

---

## The two planes

The core idea, and it maps 1:1 onto shadcn's `SidebarInset`:

```
┌─ aurora (fixed, z0) ──────────────────────────────┐
│  ┌ sidebar ─┐   ┌ floating glass panel (z10) ────┐ │
│  │ root     │   │  toolbar                        │ │
│  │ tint,    │   │  ┌──┐ ┌──┐ ┌──┐  photo grid     │ │
│  │ aurora   │   │  └──┘ └──┘ └──┘                 │ │
│  │ shows    │   │                                 │ │
│  │ through  │   │                                 │ │
│  └──────────┘   └─────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

- **Root plane** — the sidebar is *not* a card. `--sidebar` is a ~14% white tint so the aurora
  shows through it; it reads as part of the base layer.
- **Floating plane** — the main content is one rounded, more-opaque glass panel (`.glass-panel`
  on `SidebarInset`), inset with margins so the aurora peeks around it, with an elevated shadow
  and a prism rim. It reads as "on top."

---

## Glass densities are split on purpose

Do **not** unify these. Each surface is tuned for its job:

| Surface | Fill | Blur | Why |
| --- | --- | --- | --- |
| **Main panel** (`.glass-panel`) | white `~0.76 → 0.66` | `blur(40px) saturate(1.6)` | Denser working glass: legible behind photos + text, clearly "on top." |
| **Lightbox stage** (`PhotoViewer`) | `bg-white/20` | `backdrop-blur-2xl` | Airier — it's a focused overlay over a darkened backdrop. |
| **Lightbox meta pane** | `bg-white/40` | `backdrop-blur-xl` | Translucent but readable for EXIF text. |
| **Sidebar (root)** | `--sidebar` ~white/14 | none | The base layer; the aurora is the "material." |

The main panel started at ~0.94 (a flat white card — glass in name only) and was tuned down until
the aurora visibly tints it without washing out. If you touch it, keep transparency high enough
that the `backdrop-blur` actually has something to do.

---

## Signature: the prism edge

A conic-gradient rim (peach → lilac → sky → mint) masked to just the border of a surface, so it
looks like frosted glass catching the aurora light.

- `.glass-panel::before` — always-on at `opacity: 0.35` (the main panel + lightbox stage rim).
- `.prism-edge` — starts at `opacity: 0`, rises to `0.9` when its parent `.group` is hovered or
  focused (photo tiles). Must be a **direct child** of the `.group` element.

---

## Aurora

A fixed, `pointer-events:none` background of four blurred radial blobs that drift slowly
(`.aurora` + `.aurora .b1..b4`). Deliberately **subtle** — it should read as ambient light, not
wallpaper. Current palette leans **cool/purple**:

| Blob | Color | Note |
| --- | --- | --- |
| b1 | peach `#ffd9cf` | softened & dialed back (`opacity: 0.55`) |
| b2 | lilac `#c7adff` | **dominant**, strengthened (`opacity: 0.9`) |
| b3 | mint `#bef0dd` | |
| b4 | sky `#bfe3ff` | |

Blobs are `64vmax`, `blur(70px)`, base `opacity: 0.8`. A soft white top-wash (`.aurora::after`,
`rgba(255,255,255,0.35)`) keeps the top light. Animations are disabled under
`prefers-reduced-motion`.

---

## Type & color

- **Serif** (`--font-serif`, Georgia) — *italic* for the wordmark, view titles, and lightbox
  filename. The editorial voice.
- **Mono** (`--font-mono`) — EXIF facts and the `PLATE 004 / N` number. The instrument voice.
- **Sans** (`--font-sans`, `-apple-system` first) — all other UI.
- **Accent** — iris/violet, `--primary: oklch(0.53 0.17 293)` (`#6e56cf`). Used for selection,
  the upload button gradient (`→ #5a41b8`), focus rings.
- **Canvas** `#f6f5fb` · **ink text** `#332b49` · **ink-soft** `#69607f`.
- **Radius** — base `0.75rem`; panel `26px`, tiles `20px`.

---

## Lightbox

Adopted from the editorial bakeoff prototype, re-skinned bright: a centered glass stage over a
blurred, darkened backdrop, image on the left, an editorial metadata pane on the right with
`PLATE 004 / N` numbering, a serif-italic filename, and a mono EXIF fact list. Keyboard: `←/→`
navigate, `Esc` closes.

---

## How to extend

1. Reach for **tokens in `main.css`** first; add new glass surfaces with the existing
   `.glass-panel` / `.prism-edge` primitives rather than new one-offs.
2. Keep the aurora **subtle** and the two glass densities **distinct**.
3. Photos are the subject — chrome stays quiet; don't let glass compete with the images.

## Known gaps

- **Dark mode** is unstyled (old blue tokens; no aurora/glass treatment).
- The **search** field filters client-side over the already-fetched set, not server-side.
