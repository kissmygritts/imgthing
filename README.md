# imgthing

A single-owner, self-hosted photo library on Cloudflare — Nuxt on Workers, D1 for
metadata, R2 for originals, Cloudflare Images for on-the-fly variants.

## Stack

- **Nuxt 4** (SSR) on **Cloudflare Workers** via the nitro `cloudflare_module` preset
- **shadcn-nuxt + reka-ui + Tailwind v4** for UI (new-york style, neutral base, `app/components/ui`)
- **Biome** for lint/format (tabs, double quotes)
- **D1** (`DB`) metadata · **R2** (`BUCKET`) originals · **Cloudflare Images** (`IMAGES`) variants

UI workflow mirrors the `plinth` project: components live in `app/components/ui/`, added via
`npx shadcn-vue@latest add <name>`, using `cn()` from `@/lib/utils` and cva variants.

## Develop

```bash
npm install
npm run db:migrate:local   # apply D1 migrations to local miniflare state
npm run dev                # bindings emulated via nitro-cloudflare-dev
```

Sanity check: `GET /api/health` reports which bindings (DB/BUCKET/IMAGES) resolved.

Scripts: `dev`, `build`, `preview`, `deploy`, `check` (biome), `typecheck`,
`db:migrate:local`, `db:migrate:remote`.

## Cloudflare provisioning (needs your account — do these once)

1. **Create D1** and paste its id into `wrangler.jsonc` (`database_id`, currently a placeholder):
   ```bash
   npx wrangler d1 create imgthing
   ```
2. **Create the R2 bucket**:
   ```bash
   npx wrangler r2 bucket create imgthing-photos
   ```
3. **Enable Cloudflare Images** transformations for the zone (dashboard → Images), so
   on-the-fly variants can read from R2.
4. **Apply migrations to remote D1**: `npm run db:migrate:remote`.
5. **Deploy**: `npm run deploy`.
6. **Domain**: add `gritts.net` to Cloudflare DNS and point a Workers Custom Domain at the app.

## Data model

`server/db/migrations/0001_init.sql` — `folders`, `photos`, `exif_data` (EXIF `other_data`
stored as JSON TEXT). No `user_id` scoping: everything belongs to the single owner.
