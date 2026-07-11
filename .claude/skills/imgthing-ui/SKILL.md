---
name: imgthing-ui
description: Build or modify UI in imgthing — pages, components, layouts, styling, copy. Use whenever adding a new page or component, restyling existing UI, picking a surface vocabulary (glass panel vs. glass chip vs. photo tile vs. card), writing user-facing strings, or wiring empty/loading states. Fires on "build a page for X", "add a component", "make a tile / chip / toolbar for Y", "style this", "/imgthing-ui", and on edits to anything under `app/pages/`, `app/components/` (non-`ui/`), `app/layouts/`, or `app/assets/css/main.css`.
---

# imgthing-ui

imgthing has a specific visual language — **"Bright Studio Glass"**: a subtly
drifting aurora behind the whole app, a translucent sidebar that sits *on* it,
and content floating *above* it in a rounded glass panel. Chosen in Milestone 6
via a three-way design bakeoff (dark Vision-Pro vs. bright aurora vs.
editorial) — bright aurora won, with the editorial lightbox layout grafted in.
New UI drifts when it's built without referring back to that language. This
skill is the durable spec *and* the working recipe book — there is no separate
design doc; this file is the single source for the "why" and the "how".

> **Where the canonical examples live:** the live `/styleguide` route renders
> every token, surface, and primitive once, standalone. Prefer it over
> re-deriving styles. The source of truth for tokens/glass/prism is
> `app/assets/css/main.css`; the two-plane shell is `app/layouts/default.vue`.

## When this skill fires

- Creating a new page under `app/pages/`.
- Adding or restyling a component in `app/components/` (skip `ui/` — that's
  shadcn-vue, follow its own conventions).
- Picking a surface vocabulary (glass panel vs. glass chip vs. photo tile vs.
  shadcn `Card` vs. dashed empty-state).
- Writing user-facing strings, headings, button labels.
- Touching theme tokens, the aurora, glass, or prism in `main.css`.
- The user asks for "a page for X," "a toolbar that…," "make this match the
  gallery."

If the user is just floating a design idea ("could we show X?"), recommend
before building.

## The three anchors (don't violate these)

1. **Two floating glass planes on the aurora.** The aurora is a fixed root plane
   (z0). Riding on it are **two peer glass planes** — the **sidebar** and the
   **content panel** — both using the *exact same* `.glass-panel` material
   (aliased in `main.css`, §"The floating panel"), floating as inset rounded
   cards with **even aurora gaps** around and between them (the root sets one
   consistent padding; sidebar wrapper padding == panel margin). They differ only
   in *layout* (the sidebar's width/rounding vs. the panel's), never in material.
   The aurora peeks around and between both cards. Never break the even spacing,
   never let the two planes' glass drift apart, and never turn a panel into a flat
   white card. *(This supersedes the old "sidebar is a translucent base tint, not
   a card" model — the sidebar is now a full floating glass peer. Decided
   2026-07-10; see `CONTEXT.md` → Shell planes.)*
2. **Photos are the subject; chrome recedes.** Glass, aurora, and accent stay
   quiet so images carry the color. The aurora is *ambient light, not
   wallpaper* — keep it subtle. Don't let a new surface out-shout the photos.
3. **Single owner, single accent.** One iris/violet accent (`--primary`) for
   selection, primary actions, focus. No second brand hue, no per-user theming,
   no multi-tenant concepts (there's no `users` table — see CLAUDE.md).

If a design choice fights any of these, push back in chat before building it.

## Token cheat sheet

Always-correct tokens (defined in `app/assets/css/main.css`, oklch throughout):

| Surface | Token | Notes |
|---|---|---|
| Page canvas | `bg-background` | The aurora root plane paints over it; you rarely set this directly. |
| Card / solid surface | `bg-card` | shadcn `Card`. Data-dense readouts (settings), not photo chrome. |
| Muted block | `bg-muted`, `text-muted-foreground` | Secondary text, quiet fills. |
| Border | `border-border` | Default hairline. `border-dashed` for empty/placeholder. |
| Brand / accent | `text-primary`, `bg-primary`, `bg-primary/15`, `ring-primary` | The iris accent. Selection, primary CTAs, focus. Use `<Button>` for CTAs. |
| Accent-on-glass active | `bg-primary/15 text-accent-foreground` | The "active pill" look (selected filter, active toggle). |
| Failure / destructive | `text-destructive`, `bg-destructive/10`, `border-destructive/40` | Delete affordances, empty-trash, errors. |
| Success | `text-success`, `bg-success/15`, `border-success/30` | Completed states (upload done). Mint hue, echoes the aurora/prism. |
| Warning | `text-warning`, `bg-warning/15`, `border-warning/30` | Cautions, rejected/duplicate states — not a hard failure. Peach hue, echoes the aurora/prism. |

**Glass is an idiom, not a token.** The signature frosted chips are built from
`bg-white/N` over the aurora — see "Glass surfaces" below. Keep the light/dark
pair together every time.

**Hard rules:**

- **No arbitrary Tailwind values for the type/spacing scale.** Never `text-[9px]`,
  `w-[273px]`. The glass shadows/insets (`shadow-[inset_0_1px_0_…]`) and the tile
  radius (`rounded-[20px]`, panel `rounded-[26px]`) are the *deliberate*
  exceptions — reuse the existing arbitrary values, don't invent new ones.
- **No raw Tailwind palette for chrome.** Never `bg-zinc-500`, `text-indigo-600`.
  Promote a token in `main.css` first. The two sanctioned raw colors:
  `text-rose-500` for the favorite heart, and the literal `#5a41b8` in the upload
  button's `from-primary to-[#5a41b8]` gradient. Don't add a third.
- **Never inline `font-family`.** Use `font-serif`, `font-mono`, `font-sans`.
- **All numbers get `tabular-nums`.** Counts, bytes, EXIF figures.
- **Both light and dark, every time.** Dark mode is class-based (`.dark` on
  `<html>`, toggled by `@nuxtjs/color-mode`). Every glass chip pairs a
  `dark:` variant. Verify both — dark was historically the neglected mode.
- **`.aurora`, `.glass-panel`, and `.prism-edge` live outside `@layer` in
  `main.css` — on purpose.** Unlayered rules beat Tailwind's
  layered utilities; that's the only reason `.glass-panel`'s background wins
  over a component's own `bg-background`. Never move them into `@layer` (or
  `@layer components`), and keep any new base-plane primitive unlayered too.

## Typography (tri-voice)

Three fonts, three jobs. Casing is Title/sentence case (imgthing is *not*
lowercase-everything like a ledger app).

| Use | Class | Casing |
|---|---|---|
| Page `<h1>`, view titles, lightbox filename | `font-serif ... italic` (filename) or `font-serif text-3xl font-normal tracking-tight` (h1) | Title / sentence case |
| Brand wordmark | the `<AppLogo>` component — `font-mono`, next to the SVG focus-screen mark | lowercase `imgthing` |
| EXIF values, byte counts, D1 table/column names | `font-mono text-xs`/`text-[13px]` | the instrument voice |
| Everything else — buttons, nav, body, captions | `font-sans` (default; `-apple-system` first) | sentence case |

### Rules

- **Serif is editorial voice, not data** — view titles (`h1`) and the lightbox
  filename. `font-serif text-3xl font-normal tracking-tight text-foreground` is
  the page-title recipe: serif, but upright — only the lightbox filename adds
  `italic`, page `h1`s don't.
- **Mono is the instrument voice, for values — not always labels.** EXIF
  values, byte counts, raw D1 table/column names are mono. In the lightbox
  fact list specifically, the *label* (`CAMERA`, `LENS`, …) is sans, uppercase,
  wide-tracked (`text-[10px] font-semibold uppercase tracking-[0.08em]
  text-muted-foreground`) and only the *value* is mono (`font-mono
  text-[13px]`) — don't make the label mono too. D1 table/column headers
  (settings/database) are the exception where the label itself goes mono.
- **Sans is everything else.** Don't reach for serif on a button or a body
  paragraph.
- **The wordmark** is the `AppLogo` component — lowercase `imgthing` in
  `font-mono` beside the SVG focus-screen mark (bracket wings flanking a circle
  shown as top/bottom arcs, split spot + aurora split bar; the spot rests out of
  focus and snaps in on hover). Don't hand-roll it — use `<AppLogo :size wordmark
  interactive />`. Renders in the sidebar header and the login card. See ADR 0007.

## Glass surfaces — the signature, and the most-copied pattern

Glass here is a small *system* of densities, each tuned to its job — **do not
unify them**. The named `.glass-*` classes live unlayered in `main.css` (so they
beat `bg-*` utilities) and are the single source for each surface; the chips are
inline recipes. The full map, by layer (see `CONTEXT.md` → the layer stack):

| Layer | Surface | Class / recipe | Scrim |
|---|---|---|---|
| base | aurora | `.aurora` | — |
| 1 · shell planes | sidebar **+** content panel (peers) | `.glass-panel` | — |
| 2 · sheets | filters sheet, viewer drawer | `.glass-overlay` | `.glass-scrim` |
| 3 · popouts | dialogs, dropdown menus | `.glass-popout` | `.glass-scrim` |
| controls | toolbar / filter / toggle chips | root-plane chip (`/55 · /12`) | — |
| controls | on-photo controls | on-photo chip (`/40 · /8`) | — |

Each `.glass-*` class is applied to *every* instance of its surface, so they
can't drift — retune the class and all instances move together. Details below.

### The floating panel — `.glass-panel`

The rounded, elevated frosted card the app content rides in. Applied to
`SidebarInset` in `app/layouts/default.vue` — you inherit it. **The floating
sidebar uses this same material**: its inner container is aliased onto every
`.glass-panel` rule in `main.css` (fill, prism `::before`, both `.dark`
variants), so the sidebar and content panel are literally the same glass and stay
in sync — retune one, both move. The two are peers (see anchor #1); the only
difference is layout. Don't add a *third* `.glass-panel` inside content — new
pages render *inside* the inherited panel.

**Both modes share one glass recipe** (source of truth: `main.css`) — the
transparency and gradient transition are deliberately identical, so light and
dark read as the *same* surface at different times of day:

| | Angle | Alpha stops | Blur | Tint hue | Saturate |
|---|---|---|---|---|---|
| Light | `165deg` | `0.50 → 0.40` | `40px` | violet-tinted white (`rgb(250,248,255)`) | **`1.4`** |
| Dark | `165deg` | `0.50 → 0.40` | `40px` | deep iris (`oklch(0.32 0.085 300)`) | **`0.85`** |

Only two things differ per mode — the **tint hue** and the **`saturate()`**.
Light *boosts* saturation (`1.4`) so the bright aurora punches through the
near-white fill instead of washing to milk; dark *cuts* it (`0.85`) so the
jewel-tone aurora reads calm, not electric. Never let the alpha stops, angle, or
blur drift apart between the two modes — if you retune transparency, retune both
together. The single tint color varies only in alpha across the gradient (no
cross-stop lightness/chroma drift).

### Root-plane glass chip — toolbar buttons, filter pills, fields

The workhorse. A frosted pill sitting on the sidebar/panel:

```html
class="rounded-full border border-white/70 dark:border-white/12
       bg-white/55 dark:bg-white/12 text-muted-foreground
       shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]
       dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]
       transition-colors hover:text-foreground"
```

Active state swaps to `border-primary/40 bg-primary/15 text-accent-foreground`.
This is the toolbar-button / select-chip / segmented-toggle recipe. Canonical:
the gallery toolbar in `app/pages/index.vue`, `ThemeToggle.vue`.

### On-photo overlay chip — controls that ride on top of an image

Airier, blurred, white-tinted so it reads on any photo:

```html
class="rounded-full border border-white/70 dark:border-white/12
       bg-white/40 dark:bg-white/8 text-white backdrop-blur
       transition hover:bg-white/60 dark:hover:bg-white/15"
```

Hover-reveal ones add `opacity-0 group-hover:opacity-100`. Canonical: the
favorite / add-to-folder / restore buttons on gallery tiles.

### Layer-2 overlay glass — `.glass-overlay` (sheets & the viewer drawer)

The material for **layer-2 overlays** — anything that floats *above the whole
shell* behind a scrim: the filters sheet, the `PhotoViewer` details drawer, any
future sheet. It's its **own density** — airier and blurrier than the shell
panel (`/40` fill, `blur-xl`, a violet glow, no inset highlight). It's a shared
class in `main.css`, applied to *both* the drawer and `SheetContent`, so the
overlays are literally the same glass and can't drift. Its companion is
**`.glass-scrim`** — the soft violet-blurred dim behind every overlay (*not* a
black curtain), shared by `SheetOverlay` and the viewer backdrop. Reach for a new
sheet via the shadcn `Sheet` (it already carries both), and if you hand-roll an
overlay, use `.glass-overlay` + `.glass-scrim` — never re-derive the values.

### Layer-3 popout glass — `.glass-popout` (dialogs & menus)

The material for **layer-3 popouts** — small, transient, trigger-anchored
surfaces above everything: dialogs and every dropdown-menu variant
(`DialogContent`, `DialogScrollContent`, `DropdownMenuContent`,
`DropdownMenuSubContent`, all carry it). One shared class in `main.css`. It's
**more transparent than you'd expect** (`0.60` light / `0.64` dark) *on purpose*:
menus open over the *sidebar* — itself an already-blurred glass plane — so a
stacked `backdrop-blur` has nothing sharp left to bite on. There, **transparency**
(revealing the aurora-tinted substrate), not blur, is what reads as glass; dialogs
sit over opaque photos where the blur *does* bite, so they stay legible at the same
fill. Dialog scrims use `.glass-scrim` too. **Deliberately not glass:** tooltips
(intentional inverted high-contrast micro-labels — glass would cost legibility)
and the tag autocomplete (a native `<datalist>`, browser-rendered and unstylable
— slated for a real combobox later).

**Glass rule of thumb:** on chrome → root-plane chip (`/55 · /12`, inset
highlight); on a photo → on-photo chip (`/40 · /8`, `backdrop-blur`, no inset); a
layer-2 sheet/drawer → `.glass-overlay`; a layer-3 dialog/menu → `.glass-popout`;
any scrim behind an overlay/popout → `.glass-scrim`.

## The prism edge — the signature rim

A conic-gradient rim (peach→lilac→sky→mint) masked to a surface's border, so it
catches the aurora like real glass.

- `.glass-panel::before` — always-on rim on the main panel (you get it free).
- `.prism-edge` — starts invisible, rises to `opacity: 0.9` when its parent
  `.group` is hovered/focused. **Must be a direct child of the `.group`
  element.** Use it on any interactive glass tile:

```html
<div class="group relative overflow-hidden rounded-[20px] ...">
  <!-- content -->
  <span class="prism-edge" />
</div>
```

Don't hand-roll a gradient border — reuse `.prism-edge` (or `.glass-panel` for
the always-on rim).

## Container vocabulary — four roles

When in doubt, ask: *is this photo chrome, or is this a data readout?*

### Photo tile — the gallery grid unit

`group relative aspect-square overflow-hidden rounded-[20px]` with a soft drop
shadow, `hover:-translate-y-1`, an `<img>` filling `inset-0 object-cover`,
overlay chips, a `.prism-edge`, and a `shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]`
glass edge. Selected tiles get `ring-2 ring-primary ring-offset-2`. Canonical:
`app/pages/index.vue`.

### Glass chip / pill — actions, filters, toggles

The root-plane glass chip above. Toolbar buttons, sort menus, segmented
controls, the search field. Never a raw `<button class="bg-primary…">` for a
chrome control — use the chip recipe or `<Button>`.

### shadcn `Card` — data readouts

`bg-card` cards (`@/components/ui/card`) for dense, non-photo data: the settings
usage stats, storage breakdown, D1 row counts. Numbers get `tabular-nums`.
Canonical: `app/pages/settings/usage.vue`. This is the *solid* surface — it's
not glass, and that's correct: it's reading data, not floating photos.

### Dashed empty-state — nothing-here panels

```html
class="flex flex-col items-center justify-center gap-3 rounded-2xl
       border border-dashed border-border py-20 text-center"
```

An icon + a bold line + a muted explanation. Canonical: the empty gallery in
`app/pages/index.vue`. The dashed border is the signal: placeholder, not data.

**Don't invent a fifth surface weight.** If these four don't cover your case,
raise it as a design question first.

## Page shell — the recipe every page follows

Pages render inside the glass panel (the default layout supplies aurora +
`.glass-panel` + scroll container + mobile `SidebarTrigger`). A page is just a
titled column:

```vue
<template>
  <div class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
    <header class="border-b border-border pb-5">
      <h1 class="font-serif text-3xl font-normal tracking-tight text-foreground">
        Page title
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">One-line dek.</p>
    </header>
    <!-- body -->
  </div>
</template>
```

- **Container width.** `max-w-5xl` for narrow forms/settings/docs pages; the
  gallery goes full-width (no `max-w`). Pick from what pages already use;
  don't invent a width.
- **Vertical rhythm.** `gap-6` on the page column is the default (`gap-4` inside
  cards). Stay consistent.
- **Padding.** Outer page padding is set by the layout
  (`px-4 py-5 sm:px-7 sm:py-7`). Don't re-pad the page container.
- **Don't set `min-h-screen` or fixed heights** — the layout's scroll container
  owns height.

## Pill sub-nav — segmented section nav

Settings uses a wrapping pill nav (active = filled primary, rest = root-plane
glass chip). Reuse it verbatim for any sub-sectioned page — canonical:
`app/pages/settings.vue`.

## Voice & copy

- **Title/sentence case for headings and prose.** "All photos", "Empty trash",
  "Storage breakdown" — not lowercase. (imgthing is editorial-warm, not a
  terminal.)
- **The wordmark** `imgthing` is always lowercase mono, via `<AppLogo>`. Don't
  title-case it, set it in serif, or hand-roll the type.
- **Instrument facts stay mono** — EXIF values, byte counts, raw table names.
  Don't dress them up in serif.
- **Photos are the product.** User-facing copy talks about photos, folders,
  tags — not R2 keys, D1 rows, or variants (those surface only in the
  settings/usage instrument view, deliberately). Don't leak infra vocabulary
  into gallery copy.

## Before you ship — checklist

- [ ] Page is a titled `max-w-*` column inside the inherited glass panel — no
      second `.glass-panel`, no re-padding, no `min-h-screen`.
- [ ] Title is `font-serif text-3xl font-normal tracking-tight`; body is sans;
      instrument facts are mono.
- [ ] Every glass chip pairs light + `dark:` values, and you verified both
      modes.
- [ ] Surface vocabulary is right: photo tile / glass chip / `Card` / dashed
      empty-state. The four-way test was applied — no invented fifth weight.
- [ ] Interactive glass tiles carry a `.prism-edge` as a direct `.group` child;
      no hand-rolled gradient borders.
- [ ] No raw Tailwind palette (beyond the two sanctioned: `rose-500` heart,
      `#5a41b8` upload gradient) and no invented arbitrary values.
- [ ] Numbers have `tabular-nums`. Accent is the single iris `--primary`.
- [ ] Legible and operable at phone width (~375px) in both light and dark.
- [ ] Used `<Button>` / shadcn primitives instead of hand-rolling; new
      client library actions live in `composables/useLibrary.ts`.
- [ ] `npm run check` + `npm run typecheck` clean; verified visually in
      `npm run dev`.

## Anti-patterns (each fights the language)

- **A *third* glass plane, or letting the two drift apart.** The sidebar and the
  content panel are the two sanctioned `.glass-panel` planes — identical material,
  even gaps. Don't add a third glass plane *inside* content (new pages render on
  the inherited panel), don't give the sidebar and panel different glass, and
  don't break their even spacing.
- **Unifying the glass densities.** The two shell planes share one density
  (`.glass-panel`), but the chips are separate: the `/55` chrome chip and `/40`
  on-photo chip are tuned apart from the panel on purpose. Don't collapse the
  chips into the panel density.
- **A flat white card in place of glass.** If transparency is low enough that
  `backdrop-blur` has nothing to do, it's not glass — pull the opacity down.
- **Loud aurora / a second accent hue.** The aurora is ambient; `--primary` is
  the only brand color. Adding a warm second accent muddies the photos.
- **Serif on buttons/body, or lowercasing prose.** Serif italic is for the
  wordmark, titles, and filenames only. Headings are Title/sentence case.
- **Raw palette classes** (`bg-indigo-500`, `text-emerald-600`). Promote a token
  first.
- **Dark mode as an afterthought.** Ship both modes together or not at all.
- **Multi-tenant thinking** — per-user scopes, a `users` table, per-row
  ownership. Single owner, everywhere.

## Canonical references (read before building anything similar)

| Want to build | Read |
|---|---|
| The tokens / aurora / glass / prism source | `app/assets/css/main.css` |
| The two-plane shell | `app/layouts/default.vue` |
| A living gallery of every primitive | `app/pages/styleguide.vue` (`/styleguide`) |
| A photo grid + glass toolbar + tiles | `app/pages/index.vue` |
| Root-plane chrome (brand, search, upload, nav) | `app/components/AppSidebar.vue` |
| A data-readout page (cards, stats) | `app/pages/settings/usage.vue` |
| A pill-sub-nav sectioned page | `app/pages/settings.vue` |
| The lightbox (image viewer + EXIF fact drawer) | `app/components/PhotoViewer.vue` |
| The segmented glass toggle | `app/components/ThemeToggle.vue` |

Cross-references:

- `CLAUDE.md` — repo operating manual (single-owner rule, hard conventions).
