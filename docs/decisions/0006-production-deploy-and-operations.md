# ADR 0006 — Production deployment & durability posture

**Status:** Accepted · 2026-07 — deployed to production 2026-07-07 (`git log` `5123ced`,
`6b023f8`). First live deploy after the app was built and hardened entirely in local dev.

## Context

imgthing had never run outside local dev — `wrangler.jsonc`'s `database_id` was a placeholder and no
remote D1/R2 existed. The two prior sprints deliberately excluded provisioning because it needs the
owner's Cloudflare account and can't be done unattended. With the feature set complete and the two
P0 safety items resolved (brute-force throttle shipped, [ADR 0005](./0005-precomputed-variants-from-r2.md)
removed the custom-domain/purge-token serving dependency), the app was ready to ship. This ADR
records the deploy topology and the durability posture it commits to. The step-by-step runbook is
[`../cloudflare-setup.md`](../cloudflare-setup.md).

## Decision

**Deploy the single Worker to Cloudflare with a custom domain, provisioning remote D1 + R2 against
the owner's account.**

### Topology

- **Compute:** one Worker (`imgthing`), `nuxt build && wrangler deploy` (the `deploy` npm script).
  Nuxt SSR + the static client served via the `ASSETS` binding.
- **Bindings (production):** `DB` → remote D1 `imgthing` (`database_id` now real in `wrangler.jsonc`),
  `BUCKET` → R2 `imgthing-photos`, `IMAGES` → account-level Cloudflare Images. Observability enabled.
- **Migrations:** applied to remote D1 via `npm run db:migrate:remote` (`0001`–`0008`). Additive-only
  discipline (never edit a prior migration) means remote and local converge from the same directory.
- **Custom domain, even though it isn't required.** ADR 0005 made the app fully functional on
  `*.workers.dev` (variants are plain R2 reads — no `/cdn-cgi/image/` zone dependency). We still put
  it behind a Custom Domain on `gritts.net` (dashboard-configured, not in `wrangler.jsonc`) for a
  memorable URL and stable public share links. This is a convenience choice, not an architectural
  dependency — the serving model does not rely on the zone.

### Secrets

Two Worker secrets set via `wrangler secret put` before first deploy (never committed;
`.dev.vars` locally): `APP_PASSPHRASE` (the app password) and `SESSION_SECRET` (HMAC key for session
cookies). See [ADR 0003](./0003-hand-rolled-auth.md). Rotating `SESSION_SECRET` invalidates all
sessions — the only revocation lever for the stateless cookie.

### Durability posture ("don't lose photos")

Three layers, defense-in-depth:

1. **Soft delete / trash** (shipped, migration `0005`) — deletes are `deleted_at` tombstones with a
   Trash view + restore; only empty-trash/purge removes R2 bytes + D1 rows. Covers *accidental*
   deletion, which is the likeliest data-loss path.
2. **Platform backups** (provision-time toggles, **not yet enabled** — the open P1 item): D1 Time
   Travel for point-in-time metadata recovery + R2 object versioning for originals/variants. Chosen
   over a hand-built backup pipeline because they're free, zero-code, and cover the two stores that
   matter. Enable in the dashboard; no code change.
3. **Export-everything escape hatch** (deferred, pairs with bulk download in `../TODO.md`) — the
   anti-lock-in path that also doubles as an offline backup. Code-side work, not yet built.

## Consequences

- The app is live and single-owner-gated on the open internet; the login throttle (`0007`) and
  hand-rolled auth (`0003`) are the only front door.
- **Backups are a known gap until the D1 Time Travel + R2 versioning toggles are flipped.** Soft
  delete covers fat-finger deletes today, but not account-level or platform-level loss. This is the
  top-ranked remaining operational task (P1).
- Cloudflare Images free tier (5,000 transforms/month ≈ 1,600 uploads) is the one metered surface;
  a usage alert is the guardrail. Everything else (R2/D1 reads at personal scale) is effectively free.
- Portability is unchanged from [ADR 0001](./0001-cloudflare-native-stack.md) — tied to Cloudflare
  primitives by design; the custom domain adds no new lock-in beyond DNS.
