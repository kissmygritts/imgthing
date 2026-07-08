# Loop 4 — In-app API documentation ✅ COMPLETE

**Items:** #8 in-app API documentation.
**Human input:** low–medium (one format decision). Single-item loop.
Follow the [loop protocol](./README.md#the-loop-protocol-applies-to-every-plan-here): one subagent,
gate must pass, one commit.

**Status: COMPLETE (2026-07-07).** Shipped via route annotations + Nitro's OpenAPI, not the
hand-authored page originally planned below. See "What shipped" — the original plan is kept for
history.

---

## What shipped (supersedes the plan below)

The format decision flipped from **hand-authored** to **generated from the source of truth**, because
Nitro exposes exactly the manifest the original plan assumed it didn't:

- **`nitro.experimental.openAPI`** (dev-only) auto-generates `/_openapi.json` and serves readable docs
  at `/_scalar` and `/_swagger`. No hand-authored `apiRoutes.ts`, no custom Vue page, nothing to keep
  manually in sync.
- **Every `server/api/**` handler carries a `defineRouteMeta({ openAPI: {...} })` block** — tags,
  summary, description, parameters, requestBody, responses, security. Gated routes use
  `security: [{ sessionCookie: [] }]`; only `auth/*` and `health` use `security: []`. The
  `sessionCookie` scheme is defined once via `$global` in `health.get.ts`.
- **`test/unit/openapiMeta.test.ts`** is the completeness guard: a static source scan that fails the
  gate if any `server/api/**` handler lacks the annotation (summary, responses, gating-correct
  security). This replaces the original "risk to watch: keeping the list in sync" — drift is now a
  test failure, not a hope.
- **CLAUDE.md** carries the "New/changed API endpoint ⇒ OpenAPI annotation" rule next to the
  integration-test rule.

**Surfacing (decided 2026-07-07):** kept **dev-only**. The docs routes (`/_openapi.json`, `/_scalar`,
`/_swagger`) live outside `/api`, so shipping them would be fully public. That's acceptable for the
authed API surface, but the raw Nitro spec also lists the `/p/{token}/*` share routes as bare stubs
(every scanned handler gets a path entry). Exposing those path *templates* is low real risk — the
token is the secret and isn't in the spec — but a published doc would still need filtering to
`/api/**` for cleanliness. Not worth it right now; dev-only is enough. If we ever publish, the
follow-up is: `nitro.openAPI.production: "prerender"` + filter the spec to `/api/**` + a stable
`/docs` link. Left unbuilt intentionally.

Commits: `70a1b8a` (annotations + config), `54722e6` (stale GPS test fix), `e351962` (completeness
test + CLAUDE.md rule), `ba0cb2c` (config comment fix).

---

## [x] Item 8 — In-app API documentation page (original plan, superseded)

**Label:** Feature / Docs. **Effort:** M. **Commit:** `feat: in-app API reference page`.

### Current state (confirmed)
- **30 endpoints** under `server/api/**`, all session-gated except `/api/auth/*` and `/api/health`
  (`server/middleware/auth.ts`). Full enumerated list (method, path, params, one-line description) was
  produced during exploration — the subagent should re-derive it directly from `server/api/**` at build
  time to be authoritative, not copy a stale list.
- Public share routes `server/routes/p/[token]/**` are **outside `/api`** and are a *different
  audience* (unauthenticated link recipients). **Do not document their internals** in this owner-only
  reference (they enforce a uniform bare-404 and must not leak token behavior). At most, a one-line
  "public share links exist and are intentionally undocumented here" note.
- UI kit is **shadcn-vue/reka**, not `@nuxt/ui`. Available: `card`, `collapsible`, `badge`, `separator`,
  `dialog`, `tooltip`, `button`, `input`. **No `accordion`, no `tabs`, no code-block/syntax component.**
- New page auto-registers as a file route and is owner-gated by `app/middleware/auth.global.ts`; link
  it from the sidebar (`NuxtLink` pattern at `AppSidebar.vue:134`/`:181`) or the user menu.

### Implementation
1. **Format decision (defaulted):** **hand-authored data structure**, not runtime route introspection.
   Nitro doesn't expose a clean route manifest and generating one is disproportionate for ~30 stable
   endpoints. Author a typed array (e.g. `app/data/apiRoutes.ts`) of
   `{ method, path, auth, params[], description, exampleResponse }` grouped by resource
   (auth, photos, folders, tags, cameras/lenses, health). Keep example responses short + realistic.
2. **Page:** `app/pages/api.vue` (or `app/pages/settings/api.vue` if the human wants it under Settings —
   see open question). Render groups as sections; each endpoint as a row with:
   - an HTTP-method **pill** using `badge` (color per method),
   - the path (monospace),
   - an auth indicator (gated vs. public),
   - params list,
   - a **collapsible** (there's no accordion) revealing the example response in a styled `<pre>`
     code block (build a minimal code-block component/util — none exists; plain `<pre>` + mono + the
     glass surface tokens is fine).
3. **Nav:** add a sidebar / user-menu link to the page.
4. Legible + operable at ~375px in both themes; wide code/paths scroll inside `overflow-x-auto`
   containers, never the page body. Reuse Bright Studio Glass tokens.
5. **Scope guard:** document only the session-gated `/api/**` surface (+ the auth/health exceptions,
   clearly marked "unauthenticated"). Exclude `server/routes/p/**` internals.

### Verify
- Manual: page lists all `/api/**` endpoints grouped, method pills correct, example responses expand.
  Cross-check the count against `server/api/**` so nothing's missing.
- Gate: `npm run check && npm run typecheck && npm run test:all`. (Client + static data; **no new API
  endpoint**, so no new integration test — the gate must still pass.)

### Open questions
- **Q (format — decided):** hand-authored vs. generated → **hand-authored** (above). If the human later
  wants it always-in-sync, a follow-up could introspect route files at build time, but that's out of
  scope for this loop.
- **Q (placement — low stakes):** top-level `/api` page linked in the sidebar, **or** a tab under
  Settings (`/settings/api`)? **Default: top-level `app/pages/api.vue` with a sidebar link.** If Loop 2
  already shipped the settings shell and the human prefers consolidation, nesting it under Settings is
  equally fine — record the choice. Not a blocker.
- **Risk to watch:** keeping the hand-authored list in sync with future endpoint changes. Add a short
  note at the top of `apiRoutes.ts` reminding that new endpoints must be added here (and ideally
  mention it in `CLAUDE.md`'s "new endpoint" checklist in a later docs pass — out of scope now).
