# Cloudflare setup — what you need to do next

These steps need **your** Cloudflare account, so I can't run them for you. Each command is
copy-paste ready. Run them from the repo root. Tick the boxes as you go.

> Tip: to run an interactive command in this Claude session so I can see the output, prefix it
> with `!` in the prompt (e.g. `! npx wrangler login`).

---

## 0. Authenticate wrangler

```bash
npx wrangler login
```

Opens a browser to authorize wrangler against your account. One-time.

- [ ] Logged in (`npx wrangler whoami` shows your account)

---

## 1. Create the D1 database

```bash
npx wrangler d1 create imgthing
```

This prints a block like:

```
[[d1_databases]]
binding = "DB"
database_name = "imgthing"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id`** and paste it into `wrangler.jsonc`, replacing the placeholder:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "imgthing",
    "database_id": "PASTE_IT_HERE",   // <-- was REPLACE_WITH_D1_DATABASE_ID
    "migrations_dir": "server/db/migrations"
  }
]
```

Then re-run `npx wrangler types` so the change is picked up.

- [ ] D1 created
- [ ] `database_id` pasted into `wrangler.jsonc`

---

## 2. Create the R2 bucket

```bash
npx wrangler r2 bucket create imgthing-photos
```

The binding (`BUCKET`) and bucket name are already wired in `wrangler.jsonc` — nothing to paste.

- [ ] Bucket `imgthing-photos` created

---

## 3. Apply migrations to the remote D1

(The local DB is already migrated. This does the cloud one.)

```bash
npm run db:migrate:remote
```

- [ ] `0001_init.sql` applied remotely (creates `folders`, `photos`, `exif_data`)

---

## 4. Enable Cloudflare Images transformations

In the dashboard: **your account → Images → Transformations**, and enable transformations for
the zone you'll serve from (`gritts.net` once it's added — see step 6). This is what lets the
app generate thumbnail/medium/large variants from R2 originals on the fly.

- Free tier: 5,000 unique transforms/month.
- The Worker also has an `IMAGES` binding for programmatic transforms, but URL-based transforms
  need this zone setting on.

- [ ] Images transformations enabled

---

## 5. Deploy — ⚠️ hold until auth exists

```bash
npm run deploy   # nuxt build && wrangler deploy
```

This publishes to a `*.workers.dev` URL. **The app currently has no login** (Milestone 2), so
deploying now puts an open, writable photo app on the public internet.

**Pick one before deploying publicly:**
- **A)** Wait until Milestone 2 (single-owner auth) is built, then deploy. _(recommended)_
- **B)** Deploy now but immediately put **Cloudflare Access** in front of the Worker (Zero Trust
  → Access → Applications), gating it to your email. This also happens to be option B for auth
  in the plan — it could replace Milestone 2 entirely.

If you just want to smoke-test the deploy privately, you can deploy and then delete the worker,
or gate it with Access first.

- [ ] Decided A or B (tell me which and I'll wire auth accordingly)

---

## 6. Domain: gritts.net

1. Add `gritts.net` as a zone in Cloudflare (Websites → Add a site; free plan is fine) and update
   the nameservers at your registrar.
2. Once active: **Workers & Pages → imgthing → Settings → Domains & Routes → Add Custom Domain**,
   enter `gritts.net` (or a subdomain like `photos.gritts.net`).

Custom Domains work on the free DNS plan — no paid zone needed.

- [ ] `gritts.net` added to Cloudflare
- [ ] Custom Domain pointed at the `imgthing` worker

---

## After you finish

Ping me and I'll pick up **Milestone 2 (auth)**. The one decision I need from you: **hand-rolled
single-owner login vs. Cloudflare Access** (see step 5B) — Access removes most of Milestone 2.
