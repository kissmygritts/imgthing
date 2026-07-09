# Progress

Milestones M1–M6 and backlog T1–T10 are **done** (auth, upload+EXIF, folders, gallery, viewer,
Images variants, delete, search/pagination, sort, multi-select, favorites, tags, upload page, map,
dark mode) plus a design/UX polish pass. The feature set is complete locally. Full history is in git.

The app is now **deployed and live** (2026-07-07, single-owner-gated on `gritts.net`). The sprints
that got it there focused on making it real and safe to run — soft-delete so photo deletes are
recoverable, per-IP brute-force protection on the open-internet login, and the deploy itself. The
remaining work is operational (backups) and a couple of net-new features — see **Next up** below.

## Shipped this sprint (autonomous S1–S6)

Driven unattended by [next-sprint-autonomous.md](./plans/archive/next-sprint-autonomous.md). All six tasks
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

Driven unattended by [public-photos-plan.md](./plans/archive/public-photos-plan.md), which supersedes the
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

## Shipped this sprint (autonomous feature-sprint F1–F7)

Driven unattended by [features-sprint-autonomous.md](./plans/archive/features-sprint-autonomous.md) — fix the
one broken half-feature plus fill table-stakes library gaps that need no external account or product
decision. All five functional tasks landed with the gate green; **F2 (date filtering) was later
reverted by the owner** for a redesign, leaving F1, F4, F6, F7 in the tree. **F8 (design polish) is
reserved for the owner** — the loop stopped there for a live-surface review.

- **F1 — Fix metadata editing** (`d7927d2`): the viewer's edit drawer emitted `save` into the void —
  no handler, no route. Added session-gated `PATCH /api/photos/[id]` (UPSERT of editable EXIF columns,
  `iso` coerced to INTEGER, optional `original_filename` rename, `updated_at` bump), 404 on
  missing/soft-deleted, unknown keys and `taken_at`/GPS ignored; `updatePhoto` action + `@save` wired
  in `index.vue`. 8 integration tests.
- **F2 — Date / time-taken filtering** (`9ead034`): **REVERTED** by the owner. The backend
  (`buildFilter` date params, `setDateRange`) was likely fine, but the sidebar UI (two bare native
  `<input type="date">` in a "Date taken" group) was the wrong design. The whole commit — backend,
  UI, and `dateFilter.test.ts` — was reverted to redesign date filtering from scratch after a
  proper design discussion. Not currently in the tree.
- **F4 — Duplicate detection on upload** (`b10f708`): migration `0008` adds nullable `content_hash`
  + index; upload computes SHA-256 of the bytes (non-fatal on failure), reports
  `duplicateOf: { id, filename }` for a live hash match without blocking the upload; amber per-file
  hint on the upload page. 2 integration tests. Follow-up noted: a `GET /api/photos/duplicates`
  browse view was left unbuilt (hash + upload-time report was the must-have).
- **F6 — Keyboard-shortcut help overlay** (`1be2893`): `?` (and a **kebab-menu item** — the
  standalone header button was removed by the owner) opens a reused Dialog listing the viewer's
  *real* shortcuts (`←`/`→` nav, `i` details, `Esc` close, `?` help), enumerated from the actual
  keydown handler; the overlay owns the keyboard while open so other bindings stay inert.
- **F7 — Storage-usage readout** (`c263509`): owner-only `GET /api/photos/stats` returns live
  `count`/`totalBytes` (trash-excluded) plus separate `trashedCount`/`trashedBytes`; `humanBytes()`
  formatter in `app/lib/utils.ts`; readout refreshed via `"stats"` in `refreshAll`. Now lives
  **inside the sidebar user menu** (moved out of the standalone footer readout by the owner).
  Integration + unit tests.

**Reserved — F8 (design polish, HUMAN):** the new surfaces (date control, duplicate hint, keyboard
overlay `<kbd>` styling, storage readout) are functional-but-plain out of the loop. Final visual fit
against Bright Studio Glass (`.claude/skills/imgthing-ui/SKILL.md`) is the owner's review, same
split as P7a/P7b.

## Shipped: production launch (2026-07-07)

**The app is live.** Provisioned remote D1 + R2, applied all migrations (`0001`–`0008`) remotely,
set the `APP_PASSPHRASE` / `SESSION_SECRET` secrets, and deployed the Worker behind a Custom Domain
on `gritts.net` (`5123ced` wired the real `database_id`; `6b023f8` marked the runbook complete). The
serving model needs no custom domain — [ADR 0005](./decisions/0005-precomputed-variants-from-r2.md)
made it work on `workers.dev` — but we added one for a memorable URL and stable share links. Deploy
topology + durability posture are recorded in
[ADR 0006](./decisions/0006-production-deploy-and-operations.md). Runbook:
[cloudflare-setup.md](./cloudflare-setup.md).

Both P0 items are now closed: brute-force protection (`af7772d`, migration `0007` — per-IP
`login_attempts` throttle, exponential-backoff lockout, 429 before the passphrase compare) and the
deploy itself.

## Next up

The local feature set is complete and the app is deployed. What remains is operational hardening and
a couple of net-new library features. Re-ranked against current reality (2026-07-07):

### P1 — Don't lose photos (top priority now that it's live)

- **Enable platform backups.** The one unaddressed durability layer, and the only thing standing
  between "deployed" and "safe." Flip **D1 Time Travel** + **R2 object versioning** in the dashboard
  (provision-time toggles, no code). Soft-delete/trash covers accidental deletion; these cover
  platform/account-level loss. See [ADR 0006](./decisions/0006-production-deploy-and-operations.md).

### P2 — Rounding out the media library

- **Bulk download / export.** Select N → download a zip; also the "export everything" escape hatch
  (no lock-in, doubles as an offline backup). Highest-value net-new feature — users expect to get
  their originals back out. Needs streaming-zip in a Worker (stream from R2, don't buffer).
- **Date / time-taken filtering (redesign).** F2 shipped then was reverted by the owner — the
  backend was fine but the two-bare-native-date-inputs sidebar UI was wrong. Redesign the control
  first, then rebuild. `exif_data.taken_at` is stored + indexed; the `buildFilter` pattern is known.
- **Album/folder-level publishing** — publish a whole folder as a public gallery (extends the
  per-photo token model to a folder token). Security-sensitive; deferred in ADR 0005 — deserves its
  own planned sprint with a design pass, not a general feature sweep.

### Done since this list was first written (for the record)

Soft delete/trash + restore (S1), batch delete (S2), camera/lens filters (S3), upload limits (S4),
test-coverage audit (S5), mobile/responsive pass (S6), the full public-photos feature (P1–P9,
P7a/P7b), the feature sprint (F1/F4/F6/F7 + hand F8 polish), brute-force protection, and the
production deploy. The "untested endpoints" gap is closed (72 integration tests, 8 files). API
documentation (loop 4, #8) shipped as OpenAPI route annotations on every `server/api/**` handler +
Nitro's dev-only spec/Scalar UI, enforced by `test/unit/openapiMeta.test.ts`; kept dev-only.

**Brand identity** (2026-07-08) — the logo/wordplate task shipped: the placeholder aurora-iris
`.brand-mark` + serif wordmark are replaced by the **focus-screen mark** (`app/components/AppLogo.vue`
— split-image focusing screen, aurora split bar, rests out of focus and snaps on hover) and a **mono
wordmark**. New `public/favicon.svg`. Chosen from a rendered bake-off; see ADR 0007 and `CONTEXT.md`.
