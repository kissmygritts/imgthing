# Loop 1 — Fixes & mechanical wins ✅ COMPLETE

**Status:** Done — both items shipped to `main` (`6ea7a80`/`96ef4c9` mobile nav, `4511961` full EXIF).

**Items:** #1 mobile menu transparency (Bug), #2 all EXIF data (Feature).
**Human input:** none. **Order:** independent — either first.
Follow the [loop protocol](./README.md#the-loop-protocol-applies-to-every-plan-here): one subagent per
item, gate must pass, one commit each.

---

## [x] Item 1 — Fix mobile menu transparency

**Label:** Bug. **Effort:** S. **Commit:** `fix: opaque glass surface for mobile nav drawer`.

### Root cause (confirmed)
The mobile nav is a Reka `Sheet` rendered by `app/components/ui/sidebar/Sidebar.vue:33-52` when
`isMobile`. Its `SheetContent` (`app/components/ui/sheet/SheetContent.vue:37-51`) is given the class
`bg-sidebar` by `Sidebar.vue:39`, which overrides `SheetContent`'s own `bg-background`. The
`--sidebar` token is a *near-transparent tint* meant to sit **inside** the already-frosted
`.glass-panel` desktop shell:
- `--sidebar: oklch(1 0 0 / 14%)` (light) — `app/assets/css/main.css:93`
- `--sidebar: oklch(0.92 0.02 300 / 6%)` (dark) — `app/assets/css/main.css:137`

But the mobile Sheet is portaled to `<body>`, **outside** any `.glass-panel`, and `SheetContent` has
no `backdrop-filter`. So the drawer is ~14%/~6% opaque with no blur → page shows through.

### Implementation
- Give the **mobile drawer surface** a real frosted backing. Preferred: apply the existing
  `.glass-panel` treatment to the mobile `SheetContent` (it already defines the light/dark frosted
  fill + `backdrop-filter: blur(40px)` at `main.css:255-269` / `.dark` override `372-391`).
- Do it **only for the mobile sidebar drawer**, not globally on every `Sheet` — scope the change in
  `Sidebar.vue:39` (e.g. add `glass-panel` / a blurred opaque bg to the `SheetContent` class list
  there), so other future `Sheet` usages are unaffected.
- If `.glass-panel`'s `::before` prism rim conflicts with the Sheet's slide animation or close button,
  fall back to an explicit opaque-ish surface: a solid `bg-*` at high opacity **plus**
  `backdrop-blur` — the requirement is "not see-through," matching the desktop shell's feel.
- Keep the `SheetOverlay` dimming as-is.

### Verify
- Manual: `npm run dev`, narrow to ~375px (or use the mobile trigger), open the drawer in **both**
  light and dark — nav must be fully legible with no page bleed-through. Consider the `verify` skill /
  a Chrome screenshot at 375px for evidence.
- Gate: `npm run check && npm run typecheck && npm run test:all`. (Pure CSS/markup change — no new
  tests required, but the gate must stay green.)

### Open questions
- **None blocking.** Minor: whether to also nudge the `--sidebar` token itself. **Decision: no** —
  the token is correct for its in-shell desktop use; fixing it at the token level would wash out the
  desktop rail. Fix at the mobile `SheetContent` surface only.

---

## [x] Item 2 — Surface all EXIF data, not just camera settings

**Label:** Feature. **Effort:** M. **Commit:** `feat: show full EXIF detail in photo viewer`.

### Current state (confirmed)
- `server/utils/exif.ts:50-93` extracts the 10 promoted columns **and** stores the *entire* raw
  exifr parse as `other_data = JSON.stringify(output)`.
- Persisted in `exif_data` (`server/db/migrations/0001_init.sql:28-43`), incl. `other_data TEXT`.
- `app/components/PhotoViewer.vue` renders only the 7-row `facts` computed (`:209-223`): Camera, Lens,
  Focal length, ISO, Shutter, Aperture, Date. GPS is a separate map picker (`~349-432`).
- **Gap:** `other_data` (white balance, metering mode, flash, orientation, color space, software,
  exposure program, exposure bias, resolution, full lens spec, …) is persisted but **never read in
  `app/`.**

### Implementation
1. **Expose `other_data` to the client.** Check whether the photo payload the viewer consumes already
   includes `other_data`. The gallery list (`server/api/photos/index.get.ts:136-146`) does **not**
   select it — decide the smallest path:
   - Preferred: add `other_data` to the single-photo/detail payload the viewer already fetches, **not**
     to the list endpoint (keep the list lean). Confirm which endpoint `PhotoViewer` reads for detail;
     if it only has the list row, extend that row minimally or add a detail fetch. Record the choice.
2. **Parse + present.** In `PhotoViewer.vue`, `JSON.parse(other_data)` behind a guard (it can be
   null/malformed). Render a second, collapsible "Full metadata" section **below** the existing 7-row
   `facts` list — keep the curated facts as the default view; the raw/extended set is opt-in.
   - Use the existing `collapsible` primitive (`app/components/ui/collapsible/`).
   - Format keys human-readably (camelCase → "Title Case"), format known units, skip obviously-internal
     or already-shown tags, and skip empty/null values.
   - **Never render GPS from `other_data`** here — GPS stays owned by the existing map picker path and
     the promoted `gps_*` columns, so the location-privacy model is untouched.
3. Must be legible + scrollable at ~375px in both themes; long values wrap/scroll, don't overflow.

### Verify
- Manual: open a photo with rich EXIF (upload a real JPEG in `npm run dev`), confirm the extended
  section renders and the curated facts are unchanged.
- Gate: `npm run check && npm run typecheck && npm run test:all`.
- If step 1 changes any API endpoint's response shape, **add/extend an integration test** asserting
  the new field is present for the owner and the endpoint still 401s unauthenticated.

### Open questions
- **Q (low stakes, safe to default):** which fields from `other_data` are worth promoting vs. dumping
  raw? **Default:** render all non-empty, non-GPS keys generically in the collapsible section; don't
  hand-curate an allow-list this pass. Revisit only if it's noisy.
- **Q:** does the viewer's current data source already carry enough to avoid a new fetch? Resolve by
  inspection during implementation; record the decision in the commit body. Not a human blocker.
