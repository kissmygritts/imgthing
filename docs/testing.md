# Testing

Automated tests replace manual browser/curl checks of the server surface. Two layers,
both run by [Vitest](https://vitest.dev/).

## Layers

**Unit** (`test/unit/`, `vitest.unit.config.ts`) — fast, no runtime. Pure server utils
(`server/utils/exif.ts` formatters, `session.ts` `timingSafeEqual`). Node environment.

**Integration** (`test/integration/`, `vitest.integration.config.ts`) — run inside the
real Workers runtime (workerd) via [`@cloudflare/vitest-pool-workers`], against the built
nitro worker (`.output/server/index.mjs`) with **real, isolated D1 + R2 per test**. These
drive the actual HTTP routes with `SELF.fetch()` — auth flow, upload → list → raw, the
middleware guard — so they exercise the same code path a browser would.

- Test bindings/secrets: `test/integration/wrangler.jsonc` (points `main` at `.output`,
  declares `DB`/`BUCKET`/`IMAGES`, injects `APP_PASSPHRASE`/`SESSION_SECRET` as vars).
- D1 schema is applied per test from `server/db/migrations` via `test/integration/setup.ts`.
- Integration tests need a current build — `npm run test:integration` builds first.

## Commands

| Command | What |
| --- | --- |
| `npm test` / `npm run test:unit` | Unit tests only (fast) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:integration` | Build the worker, then integration tests |
| `npm run test:all` | Both layers |

CI (`.github/workflows/ci.yml`) runs both on every push.

## Adding tests

- **New util logic** → unit test; export the pure function if needed.
- **New/changed API route** → integration test in `test/integration/`. Use `login()` from
  `helpers.ts` for the auth cookie; hit routes with `SELF.fetch(url("/api/..."))`.

[`@cloudflare/vitest-pool-workers`]: https://developers.cloudflare.com/workers/testing/vitest-integration/
