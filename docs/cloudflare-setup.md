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

## 5. Set production secrets (auth)

Auth is built (hand-rolled single-owner login). It reads two secrets from the Worker env — in
dev these live in `.dev.vars`; in prod you set them with `wrangler secret put`:

```bash
# Your login passphrase — pick a strong one; this is the app password.
npx wrangler secret put APP_PASSPHRASE

# HMAC key that signs session cookies — use a long random value, e.g.:
openssl rand -hex 32   # copy the output, then:
npx wrangler secret put SESSION_SECRET
```

- [ ] `APP_PASSPHRASE` set in prod
- [ ] `SESSION_SECRET` set in prod (long random)

---

## 6. Deploy

```bash
npm run deploy   # nuxt build && wrangler deploy
```

Publishes to a `*.workers.dev` URL. The app is gated by the login now, so this is safe to expose.
First visit → `/login`; enter your `APP_PASSPHRASE`.

- [ ] Deployed and login works

---

## 7. Domain: gritts.net

1. Add `gritts.net` as a zone in Cloudflare (Websites → Add a site; free plan is fine) and update
   the nameservers at your registrar.
2. Once active: **Workers & Pages → imgthing → Settings → Domains & Routes → Add Custom Domain**,
   enter `gritts.net` (or a subdomain like `photos.gritts.net`).

Custom Domains work on the free DNS plan — no paid zone needed.

- [ ] `gritts.net` added to Cloudflare
- [ ] Custom Domain pointed at the `imgthing` worker

---

## After you finish

That's the full provisioning path. Development continues in parallel on local dev — next up is
**Milestone 3 (upload + storage + EXIF)**.
