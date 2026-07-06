# Progress

Milestones M1–M6 and backlog T1–T10 are **done** (auth, upload+EXIF, folders, gallery, viewer,
Images variants, delete, search/pagination, sort, multi-select, favorites, tags, upload page, map,
dark mode) plus a design/UX polish pass. The feature set is complete locally. Full history is in git.

The next sprint is about making it **real and safe to run** — it has never been deployed, it's a
single passphrase on the open internet, and photo deletes are currently irreversible. Ranked by
risk × value.

## Shipped this sprint (autonomous S1–S6)

Driven unattended by [next-sprint-autonomous.md](./plans/next-sprint-autonomous.md). All six tasks
landed with the gate green (`check` + `typecheck` + `test:all`; integration suite now 63 tests).

- **S1 — Soft delete / trash** (`139da58`): `photos.deleted_at` tombstone (migration `0005`),
  `DELETE /api/photos/[id]` now soft-deletes, `POST …/restore`, `?purge=1` + `DELETE /api/photos/trash`
  for permanent removal via shared `purgePhotos` helper; all listings + geo exclude tombstones; Trash
  sidebar view with Restore / Delete-forever / Empty-trash.
- **S2 — Batch delete** (`ecf3a49`): collection-level `DELETE /api/photos?ids=` single-D1-write soft
  delete (+ `?purge=1`); `bulkDelete` is now one request instead of N.
- **S3 — Camera & lens filters** (`1d27aeb`): `GET /api/cameras` + `/api/lenses` facets (live-only
  counts), `camera`/`lens` params in `buildFilter` (AND-combine), Cameras/Lenses sidebar groups.
- **S4 — Upload limits** (`981cf9b`): 25 MB/file, 50 files, 200 MB batch caps; early `content-length`
  413; partial-batch `rejected[]` reporting.
- **S5 — Test coverage audit** (`469301c`): full route audit (no bugs found); closed real gaps
  (cameras/lenses/trash auth guards, folder 404s).
- **S6 — Mobile / responsive pass** (`44dab60`): icon-only action bar on phones, phone-friendly
  viewer drawer, offcanvas sidebar closes on nav select, `SidebarEntry` menu gated to `#menu` slot.

**Still open from the list below:** deploy/provision (P0), login brute-force protection (P0),
backups (P1), bulk download/export (P2) — intentionally out of this autonomous sprint's scope.

## Shipped this sprint (autonomous public-photos P1–P9, P7a)

Driven unattended by [public-photos-plan.md](./plans/public-photos-plan.md), which supersedes the
serving layer in ADR 0004. Precomputed WebP variants in R2 + tokened public/private serving with no
new infra (no `/cdn-cgi/image/`, no purge API, no custom domain). All tasks landed with the gate
green (`check` + `typecheck` + `test:all`; integration suite now 72 tests, 8 files). **P7b (design
pass) has since landed by hand — see below.**

- **P1 — Migration 0006** (`ffe1a0c`): additive `visibility`/`public_token`/`published_at`/
  `show_location`/`variants_generated_at` columns on `photos` + unique token index.
- **P2 — Variant utility** (`4c98119`): `server/utils/variants.ts` — sizes/keys plus
  `generateVariants` and self-healing `getOrCreateVariant`; longest-side `scale-down` WebP q88
  (WebP re-encode strips EXIF natively).
- **P3 — Upload generates variants** (`3188a1c`): per-file `generateVariants` + `variants_generated_at`
  stamp in the upload loop; non-fatal on failure (serving self-heals).
- **P4 — Serving + sharing core** (`66cdeb7`): private variant route reads from R2; session-gated
  publish (mints a fresh 32-hex token every call) / unpublish; unauthenticated `/p/{token}/{size}`
  and `/p/{token}/meta` routes; uniform 404s; GPS opt-in gated behind `show_location`.
- **P5 — Trash/delete interplay** (`5d44271`): both soft-delete handlers clear the token + visibility
  in the same UPDATE (restore never re-publishes); `purgePhotos` also deletes the three variant objects.
- **P8 — Public integration suite** (`cf66966`): `test/integration/public.test.ts`, all 8 scenarios
  (auth, cookieless serving, uniform 404s, rotation, trash-unpublish, meta/GPS, self-heal, EXIF-strip).
  Caught + fixed a real bug: `/p/**` threw `createError` which Nitro rendered as the SPA HTML shell
  with HTTP 200 — a revoked token "looked alive"; now returns a bare 404 `Response`.
- **P9 — Docs** (`c930b91`): deployment note in `cloudflare-setup.md` (no new infra); fixed the stale
  "variants come in M6" comment.
- **P7a — Functional share UI** (`e2e9941`): Share dialog in the viewer (Public switch, GPS-gated
  "Show location" switch, md/lg copy-to-clipboard rows), globe badge on grid tiles + viewer;
  publish/unpublish wired through `useLibrary` mirroring the favorite toggle. Taste calls left as
  placeholders for P7b.

**P7b — design pass (done, by hand 2026-07-05):** `50244f1` public badge lower-right on tiles +
more margin on the details badge; `11e8116` merged the two share modals into one public **Share &
embed** screen; `0f63ab8` added a cURL metadata snippet ahead of the JS embed snippet. Both
autonomous sprints and the human design pass are now complete — the local feature set is done.

The serving/variant architecture is now captured in
[ADR 0005](./decisions/0005-precomputed-variants-from-r2.md) (was previously only in the plan file).

## Next sprint

Everything the two autonomous sprints scoped (soft delete/trash, batch delete, camera/lens
filters, upload limits, test coverage, mobile pass, and the whole public-photos feature) has
**shipped**. What remains is the deploy-and-harden work those sprints deliberately excluded.
Re-ranked against current reality (2026-07-05):

### P0 — Ship it (blocks everything; needs the owner's Cloudflare account)

- **Provision + deploy.** `database_id` is still `REPLACE_WITH_D1_DATABASE_ID` (confirmed in
  `wrangler.jsonc`) — the app has never run outside local dev. Create remote D1/R2, enable
  Cloudflare Images, apply remote migrations, set secrets (`APP_PASSPHRASE`, `SESSION_SECRET`),
  first `wrangler deploy`. A custom domain is **no longer required** — ADR 0005's variants-from-R2
  serving works on `workers.dev` (this is the big change since the deploy note was first written).
  See [cloudflare-setup.md](./cloudflare-setup.md). **This needs the owner** — it can't be done
  autonomously without the Cloudflare account.

### P0 — Login brute-force protection (the one shippable-now security gap)

- `POST /api/auth/login` (`server/api/auth/login.post.ts`) does a single `timingSafeEqual` with
  **no rate limit or lockout** — once public it's an open guessing target for the single
  passphrase. Add per-IP throttling. **No KV binding is configured**, so use a D1 counter table
  keyed by `CF-Connecting-IP` with exponential backoff + lockout, cleared on success. This is the
  highest-value item that does **not** need the owner's account, so it's the natural next build.

### P1 — Don't lose photos

- **Backups.** The only unaddressed durability item. Enable D1 Time Travel + R2 object versioning
  at provision time (config/ops, not code), and sketch an export-everything job (pairs with bulk
  export below). Soft-delete/trash already covers accidental deletion.

### P2 — Rounding out the media library

- **Bulk download / export.** Select N → download a zip; also the "export everything" escape hatch
  (no lock-in, doubles as a backup). Highest-value net-new feature for a media library — users
  expect to get their originals back out. Needs streaming-zip in a Worker (watch memory; stream
  from R2, don't buffer).
- **Keyboard-shortcut help overlay** for the viewer (arrow-key nav already exists; document it).
- **Date / time-taken filtering** — `exif_data.taken_at` is already stored; a date-range facet or
  a timeline scrubber is cheap relative to value (mirror the camera/lens facet pattern).
- **Album/folder-level publishing** — publish a whole folder as a public gallery (extends the
  per-photo token model to a folder token). Explicitly deferred in ADR 0005; revisit if wanted.

### Done since this list was first written (for the record)

Soft delete/trash + restore (S1), batch delete (S2), camera/lens filters (S3), upload limits (S4),
test-coverage audit (S5), mobile/responsive pass (S6), and the full public-photos feature
(P1–P9, P7a/P7b). The "untested endpoints" gap is closed (72 integration tests, 8 files).
