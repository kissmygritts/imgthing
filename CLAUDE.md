# CLAUDE.md

Guidance for working in this repo. Read `docs/` for depth — this file is the operating manual.

imgthing is a **single-owner** photo library: Nuxt 4 SSR on Cloudflare Workers, D1 for metadata, R2
for originals **and** precomputed WebP variants, Cloudflare Images used only at upload time. Deployed
and live. There is no `users` table and no per-row scoping anywhere — everything belongs to the one
owner. Don't add multi-tenant concepts.

## Where to look first

- `docs/PROGRESS.md` — what's built + what's next (start here).
- `docs/decisions/*.md` — the ADRs. Read the relevant one before changing auth (0003), the
  serving/variant model (0005), or deploy/ops (0006). **Reverse a decision by adding a superseding
  ADR, never by editing an old one.**
- `docs/architecture.html` — architecture overview + self-hosting guide. `docs/plans/archive/` —
  spent build ledgers (history, not live plans).
- `docs/cloudflare-setup.md` — the provisioning/deploy runbook (done; the re-provision reference).
- `docs/imgthing-ui.md` — the "Bright Studio Glass" design language.

Keep `docs/PROGRESS.md` current as milestones land. ADRs are `NNNN-short-title.md`, append-only.

## Commands (the gate)

Every change must pass this before it's done — it's the definition of done:

```bash
npm run check       # Biome — auto-fixes formatting; must end clean
npm run typecheck   # nuxt typecheck; zero errors
npm run test:all    # unit + integration; integration runs `npm run build` first (slow — budget for it)
```

- `npm run dev` — local dev; bindings emulated via `nitro-cloudflare-dev`. `GET /api/health` reports
  which bindings (DB/BUCKET/IMAGES) resolved.
- `npm run db:migrate:local` — apply D1 migrations to local miniflare state (run after adding one).
- `npm run test` / `test:unit` — fast Vitest unit run without the build step.

Two Vitest layers; CI (`.github/workflows/ci.yml`) runs both on every push:

- **Unit** (`test/unit/`, `vitest.unit.config.ts`) — Node, no runtime; pure server utils
  (`exif.ts` formatters, `session.ts` `timingSafeEqual`, `openapiMeta`).
- **Integration** (`test/integration/`, `vitest.integration.config.ts`) — the built worker in real
  workerd via `@cloudflare/vitest-pool-workers`, **isolated D1 + R2 per test** (schema applied from
  `server/db/migrations` by `setup.ts`; bindings/secrets in `test/integration/wrangler.jsonc`).
  Drives real routes with `SELF.fetch()`, so it exercises the same path a browser would.

## Layout

- `app/` — Nuxt front end. Pages: `index.vue` (gallery), `upload.vue`, `map.vue`, `login.vue`.
  `composables/useLibrary.ts` owns **all** client library state + mutations (select/filter/publish/
  favorite/tag/delete) — new client actions go here, mirroring the existing ones. UI primitives in
  `app/components/ui/` (shadcn-vue). `lib/utils.ts` has `cn()` + `humanBytes()`.
- `server/api/**` — session-gated JSON routes (guarded by `server/middleware/auth.ts`). Nested
  dynamic routes under `server/api/photos/[id]/`.
- `server/routes/p/[token]/**` — the **unauthenticated** public share routes (outside `/api`, so the
  auth middleware never sees them). Treat as the sensitive surface — see rules below.
- `server/utils/` — shared logic: `variants.ts` (sizing/keys/generate/self-heal — single source of
  truth), `photos.ts` (`purgePhotos`, token gen), `public.ts` (`publicNotFound()`), `session.ts`,
  `loginThrottle.ts`, `exif.ts`, `cloudflare.ts`.
- `server/db/migrations/` — additive-only SQL. `test/` — `unit/` (Vitest) + `integration/`
  (`@cloudflare/vitest-pool-workers`, real bindings).

## Hard conventions

- **Commit directly to `main`.** Local-only repo, no feature branches. One logical change per commit;
  commit only when asked.
- **Migrations are additive-only and sequential.** Next number after `0008`. Never edit a prior
  migration. Run `db:migrate:local` after adding, and add remote via `db:migrate:remote` at deploy.
- **New/changed API endpoint ⇒ integration test.** Add/extend a file in `test/integration/` using
  `import { env, SELF } from "cloudflare:test"` and the `login, pngBytes, url` helpers from
  `./helpers`. Don't claim green without running the gate.
- **New/changed API endpoint ⇒ OpenAPI annotation.** Every `server/api/**` handler carries a
  `defineRouteMeta({ openAPI: { tags, summary, description, parameters, requestBody, responses,
  security } })` block above its `defineEventHandler` (compile-time macro — no import). Gated routes
  use `security: [{ sessionCookie: [] }]`; only `auth/*` and `health` use `security: []` (the
  `sessionCookie` scheme is defined once, in `health.get.ts`'s `$global`). `test/unit/openapiMeta.test.ts`
  fails the gate if a route is unannotated. Nitro's `experimental.openAPI` (dev-only) serves the spec
  at `/_openapi.json` and readable docs at `/_scalar`. The public `server/routes/p/**` share routes are
  **intentionally excluded** — don't advertise that surface.
- **DELETE takes ids via query string, never a request body** (`?ids=a,b,c`) — there's a known
  Workers DELETE-with-body issue; follow the existing tags-detach / batch-delete convention.
- **Design language:** reuse shadcn/reka components already in `app/components/ui/`; don't add a new
  UI kit or a date-picker dependency without flagging it. Every new surface must be legible and
  operable at phone width (~375px) in **both** light and dark mode. Match Bright Studio Glass tokens
  in `app/assets/css/main.css`.
- **Biome** formats with **tabs + double quotes**. Let `npm run check` fix it; don't hand-format.

## Serving & security invariants (don't "simplify" these away)

- **Public routes return a uniform bare 404 for every failure** (bad token, wrong token, bad size,
  private, trashed) via `publicNotFound()` in `server/utils/public.ts`. This is a bare `Response`,
  **not** `createError` — for non-`/api` routes Nuxt renders a thrown error as the SPA HTML shell
  with HTTP 200, which makes a revoked token look alive and leaks app HTML. A real bug once; keep it.
- **Public bytes never carry EXIF/GPS.** Variants are WebP re-encodes (strips EXIF natively); the
  public `meta` endpoint emits GPS **only** when `show_location = 1`, and never `id`/`r2_key`/raw
  `other_data`.
- **Variants self-heal.** `getOrCreateVariant` regenerates from the original on an R2 miss, so
  upload-time generation is non-fatal and there's no backfill script. Variant sizing constrains only
  the longest side (passing both dims makes the Images binding letterbox to an N×N black box).
- **Soft delete is a `deleted_at` tombstone.** Delete handlers also clear `visibility`/`public_token`
  (trashing revokes any public link); restore never re-publishes. Only purge/empty-trash removes R2
  bytes + D1 rows and the three variant objects.
- **Auth:** single passphrase (`APP_PASSPHRASE`) + HMAC-signed stateless cookie (`SESSION_SECRET`),
  both Worker secrets. `/api/**` is gated except `/api/auth/*` and `/api/health`. Per-IP brute-force
  throttle in `loginThrottle.ts` runs **before** the passphrase compare.

## Known quirks

- Integration suite is the slow gate (it builds first). Run `test:unit` while iterating; run
  `test:all` before finishing.
- Backups (D1 Time Travel + R2 versioning) are the one open durability gap — see ADR 0006 / PROGRESS.
