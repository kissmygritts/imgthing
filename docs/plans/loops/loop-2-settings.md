# Loop 2 — Settings shell + data pages

**Items:** #7 settings shell (blocks the rest), #3 usage metrics, #4 raw DB viewer.
**Human input:** low. **Order:** #7 → then #3 and #4 (either order).
Follow the [loop protocol](./README.md#the-loop-protocol-applies-to-every-plan-here): one subagent per
item, gate must pass, one commit each. **#3 and #4 must not start until #7's box is checked.**

Context confirmed by exploration:
- No settings route exists. Pages today: `index.vue`, `login.vue`, `map.vue`, `upload.vue`.
- Single layout `app/layouts/default.vue` (`SidebarProvider > AppSidebar + SidebarInset` glass panel).
- User menu = `DropdownMenu` in `AppSidebar.vue:288-338` (SidebarFooter). Real `NuxtLink` nav pattern
  at `AppSidebar.vue:134` (upload) and `:181` (map).
- Global client auth gate `app/middleware/auth.global.ts` covers any new page automatically.
- Server auth via `server/middleware/auth.ts` (all `/api/**` except `/api/auth/*`, `/api/health`).
- Typical GET handler + integration-test pattern: `server/api/photos/stats.get.ts`,
  `test/integration/stats.test.ts`, helpers `login, pngBytes, url`.

---

## [ ] Item 7 — Settings shell + user-menu entry

**Label:** Feature. **Effort:** M. **Commit:** `feat: settings section shell and nav entry`.

### Implementation
1. **Route(s):** create `app/pages/settings.vue` as the shell with a **sub-nav** (tabs or a left rail)
   for its sub-pages. Use nested routes: `app/pages/settings/index.vue` (redirect to the first tab or a
   landing) and child pages added by #3/#4 (`settings/usage.vue`, `settings/database.vue`). If nested
   routing adds friction, a single `settings.vue` with in-page section switching is acceptable — record
   the choice. It renders inside the existing `default` layout (glass `SidebarInset`); don't add a new
   layout.
2. **Entry point:** add a "Settings" `DropdownMenuItem` (with an icon, matching existing items) to the
   user menu in `AppSidebar.vue:312-334`, as a `NuxtLink`/router push to `/settings`, placed above
   "Sign out".
3. **Shell chrome:** page title + the sub-nav scaffold only. Leave sub-page bodies as labeled empty
   placeholders that #3 and #4 fill in — the shell's job is routing + nav + layout, legible at ~375px
   in both themes using `app/components/ui/` primitives (`card`, `separator`, `button`, `badge`).
4. Single-owner app — the settings pages are just owner config; no user scoping.

### Verify
- Manual: user menu → Settings navigates; sub-nav switches sections; back/forward works; renders in
  light + dark at phone width.
- Gate: `npm run check && npm run typecheck && npm run test:all`. (Client-only; no API ⇒ no new
  integration test required.)

### Open questions
- **Q:** nested file-routes vs. single-page tabbed shell? **Default: nested routes** (`settings/` dir)
  so #3/#4 own their own files and deep-links work — but either passes if documented. Not a human
  blocker. **A:** Yes, nested routes is the correct solution.

---

## [ ] Item 3 — Storage & cloud-usage metrics page

**Depends on:** Item 7 (checked). **Label:** Feature. **Effort:** M.
**Commit:** `feat: storage usage metrics settings page`.

### Current state (confirmed)
- `/api/photos/stats` already returns live `count` + `totalBytes` and trash reclaimable
  (`server/api/photos/stats.get.ts`) by summing `photos.file_size` (the **original** bytes).
- **No variant byte sizes are tracked in D1**, and R2 is **never** enumerated (`.list()` is unused;
  keys are always derived from D1 rows — see `server/utils/variants.ts` `variantKey`,
  `server/utils/photos.ts:42-47`). So true stored bytes = originals (known) + 3 variants/photo
  (**not** tracked).

### Implementation
1. **Endpoint:** `server/api/settings/usage.get.ts` (session-gated by the global middleware; static
   `settings/` segment). Return a richer object than `stats`: live photo count, original bytes, trash
   count + reclaimable bytes, D1 row counts per table (photos, exif_data, folders, tags, folder_photos,
   photo_tags — cheap `SELECT COUNT(*)`), and a **variant-storage figure** per the decision below.
2. **Variant bytes — pick the low-cost path (see open question):** default to an **estimate** — do not
   `R2.list()` on every page load. Either (a) label variants "not tracked / estimated" and derive a
   rough multiplier, or (b) reuse originals-only and clearly label the number as "originals." Whichever,
   the UI must not imply precision it doesn't have.
3. **Cost accounting:** start with static per-GB constants (R2 storage) as a labeled estimate; no live
   billing API.
4. **UI:** `app/pages/settings/usage.vue` — stat cards (reuse `card` + `badge`), a small per-table row
   count table, human-readable bytes via `humanBytes()` in `lib/utils.ts`. Legible at ~375px, both
   themes.
5. **Integration test:** `test/integration/settings-usage.test.ts` — login, upload a PNG, assert the
   endpoint returns sane counts/bytes; assert unauthenticated → 401.

### Verify
- Manual: settings → Usage shows real numbers after uploads.
- Gate: `npm run check && npm run typecheck && npm run test:all`.

### Open questions
- **Q (decide before building step 2):** do we want *accurate* variant storage totals? That requires
  either **(A)** persisting variant byte sizes at generation time (new additive migration + write in
  `variants.ts generateVariants`, plus a note that pre-existing photos are backfilled lazily on
  self-heal), or **(B)** an `R2.list()` sweep (slow, and the bucket is never otherwise listed).
  **Default for this loop: neither — show originals + an explicitly-labeled estimate**, and leave a

- **ANSWER:** use option A and persist byte sizes at generation time.
	

---

## [ ] Item 4 — Raw database viewer page

**Depends on:** Item 7 (checked). **Label:** Feature. **Effort:** M.
**Commit:** `feat: read-only database table viewer in settings`.

### Implementation
1. **Endpoint:** `server/api/settings/db/[table].get.ts`, session-gated.
   - **Allow-list tables** in the handler — a hardcoded `Set` of `photos, exif_data, folders, tags,
     folder_photos, photo_tags, login_attempts`. Reject anything else with 404. **Never** interpolate
     the table name without allow-list membership, and **never** accept raw SQL. This is the security
     crux of the item.
   - Support `?limit` (clamped, default 50, max ~200) and `?offset` for paging, mirroring
     `photos/index.get.ts:114-115`.
   - Return `{ table, columns, rows, total }`. Read-only — **GET only, no mutations.**
2. **UI:** `app/pages/settings/database.vue` — a table selector (from the allow-list), a scrollable
   data table rendering columns/rows generically, and prev/next paging. Reuse `app/components/ui/`
   primitives; wide tables scroll inside an `overflow-x-auto` container (never overflow the page body).
   Legible at ~375px both themes.
   - Consider redacting/truncating obviously-large blobs (`exif_data.other_data`, tokens) in the cell
     render — show a truncated preview. Note: this is an owner-only page, so it's inspection convenience,
     not a security boundary.
3. **Integration test:** `test/integration/settings-db.test.ts` — login, seed a row (upload), assert an
   allow-listed table returns columns+rows; assert a non-allow-listed / bogus table name → 404; assert
   unauthenticated → 401.

### Verify
- Manual: settings → Database, switch tables, page through rows.
- Gate: `npm run check && npm run typecheck && npm run test:all`.

### Open questions
- **Q:** should `login_attempts` (contains IPs) be in the allow-list? **Default: include it** — this is
  a single-owner app and the owner is the only viewer; the whole page is owner-gated. Drop it only if
  the human prefers. Not a blocker. **ANSWER:** Do not show login_attempts. 
- **Q:** dynamic column discovery — use `PRAGMA table_info(<table>)` (table name still allow-listed) or
  infer columns from the first row? **Default: `PRAGMA table_info`** so empty tables still render
  headers. Not a blocker. **ANSWER:** The default is good
