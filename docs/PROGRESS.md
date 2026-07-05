# Progress

## Milestone 1 — Foundation · 🟡 in progress (scaffold done, provisioning pending)

**Done (2026-07):**
- Nuxt 4 (SSR) scaffolded on nitro `cloudflare_module` preset.
- UI stack: shadcn-nuxt + reka-ui + Tailwind v4 + Biome (see ADR 0002). 13 core components in
  `app/components/ui/`. Custom neutral+blue photo-app tokens in `app/assets/css/main.css`.
- `wrangler.jsonc` with `DB` (D1), `BUCKET` (R2), `IMAGES` bindings; types generated to
  `worker-configuration.d.ts`.
- D1 schema migration `server/db/migrations/0001_init.sql` (folders/photos/exif_data).
- `server/utils/cloudflare.ts` binding helpers + `/api/health` sanity endpoint.
- Verified in local dev: all three bindings resolve, D1 query works against the migrated local
  DB, home page renders. `npm run build` passes, `biome check` clean.

**Pending (needs Cloudflare account — see [cloudflare-setup.md](./cloudflare-setup.md)):**
- Create D1 + paste `database_id`; create R2 bucket; apply remote migrations.
- Enable Cloudflare Images transformations.
- Add `gritts.net` + Workers Custom Domain.
- Deploy (⚠️ hold until auth — Milestone 2).

## Milestone 2 — Auth · ✅ done

Hand-rolled single-owner login (see ADR 0003).

- `server/utils/session.ts` — HMAC-signed cookie via Web Crypto, constant-time passphrase compare.
- Routes: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`.
- Guards: `server/middleware/auth.ts` (401 for protected `/api/**`), `app/middleware/auth.global.ts`
  (redirect pages to `/login`).
- `app/pages/login.vue` passphrase form (shadcn Card/Input/Button).
- Secrets: `APP_PASSPHRASE`, `SESSION_SECRET` in `.dev.vars` (dev) / `wrangler secret put` (prod).
- Verified end-to-end in dev: wrong passphrase → 401, correct → signed cookie, protected API 401
  without cookie / passes with it, page redirect to `/login` when unauthenticated.

## Milestones 3–8 · ⚪ not started

**Next: M3 Upload + Storage + EXIF.** Then Folders · Gallery · Viewer · Search/Polish · Hardening.
