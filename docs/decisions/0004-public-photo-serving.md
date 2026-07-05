# ADR 0004 — Public/private photo serving

**Status:** Superseded · 2026-07 — the `/cdn-cgi/image/` serving layer was dropped in favor
of upload-time precomputed variants served straight from R2; see
[`docs/plans/public-photos-plan.md`](../plans/public-photos-plan.md). The token/revocation
model (Q1/Q2), uniform 404s, private bucket, and trash-implies-unpublish carry over unchanged.
The Cloudflare-docs findings below (purge semantics, `Via` header, billing) remain the
reference for why the URL-transform mode was abandoned.

## Context

Photos default to private; the owner can flip individual photos public to embed on a personal
site or forums. The R2 bucket must never be directly reachable. Cloudflare Images has two modes
with opposite trade-offs:

- **Workers binding (`env.IMAGES`)** — runs behind arbitrary auth logic, but *every call bills
  as a transformation, no dedup* ([docs](https://developers.cloudflare.com/images/optimization/binding/)).
- **URL mode (`/cdn-cgi/image/<opts>/<source>`)** — source must be a fetchable URL; output is
  edge-cached and billed *once per unique transformation per calendar month*
  ($0.50/1,000 after 5,000 free) ([pricing](https://developers.cloudflare.com/images/pricing/)).

Earlier iterations (single branching endpoint, publish-time static variants, URL-transform
pointed straight at R2) were rejected — see the design discussion summary. This ADR locks the
fourth design and resolves its open security questions, each verified against current
Cloudflare docs (2026-07).

## Decision

**Dual-mode serving over a permanently private bucket.** Private photos keep the existing
binding path (`/api/photos/:id/variant`, session-gated) plus a Cache API layer. Public photos
are served by URL-mode transforms whose *source* is an authenticated origin route on our own
zone that serves a bounded, EXIF-stripped rendition — never the original bytes.

### Schema

```sql
ALTER TABLE photos ADD COLUMN visibility   TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public'));
ALTER TABLE photos ADD COLUMN public_token TEXT UNIQUE;   -- NULL unless public
ALTER TABLE photos ADD COLUMN published_at TEXT;
```

`public_token` is 16 bytes from `crypto.getRandomValues`, base64url (~22 chars, 128 bits).
It is the *only* credential for public access, so it must be unguessable and never derived
from the photo id.

### Routes

**`GET /origin/:token`** — public origin route (outside `/api/**`, so the auth middleware
does not apply; that is deliberate).

1. Look up `photos` by `public_token = :token` where `visibility = 'public'` and the photo
   is not soft-deleted. Miss → uniform **404** (don't distinguish unknown/private/trashed).
2. Fetch the R2 object via the binding, transform via `env.IMAGES`:
   `width ≤ 2560` (the existing `lg` ceiling), `quality ~90`, **`metadata: "none"`**.
3. Respond with `Cache-Control: public, max-age=86400`.

**Publish** (`POST /api/photos/:id/publish`, session-gated): generate a *fresh* token, set
`visibility='public'`, `published_at=now`. Return the canonical embed URLs.

**Unpublish** (`POST /api/photos/:id/unpublish`): in order —

1. Read the current token; set `visibility='private'`, `public_token=NULL` in D1 (fail
   closed: from this instant every edge cache *miss* 404s).
2. Purge-by-URL the origin URL `https://<zone>/origin/<old-token>` via the zone purge API
   (needs a scoped API token + zone id as Worker secrets).

One purge call suffices: `/cdn-cgi/` URLs cannot be purged individually, but *"purging of the
original image's URL will also purge all of its optimized versions"*
([docs](https://developers.cloudflare.com/images/optimization/features/)). If the purge call
fails, the photo is already private — worst case is the TTL-bounded window below — so surface
the error and offer retry rather than rolling back.

**Public URL shape** (emitted by a share dialog, fixed named sizes):

```
https://<zone>/cdn-cgi/image/width=1280,quality=85,format=auto/https://<zone>/origin/<token>
```

### Private path hardening

`variant.get.ts` stays as-is, plus a Cache API layer: auth check **first**, then
`caches.default.match(canonicalKey)`, transform only on miss, `cache.put` without cookies.
The Cache API is per-PoP; a single owner mostly hits one PoP, so this converts repeat cold
loads into cache hits and keeps binding-call billing near the free tier.

### Interactions with delete/trash

Trashing or hard-deleting a public photo must run the unpublish routine (flag + token NULL +
purge). The origin route's query already excludes soft-deleted rows, so a missed purge only
leaves the edge TTL window.

### Zone configuration (deployment prerequisites)

- Custom domain on the Worker — `/cdn-cgi/image/` only exists on a zone, not `workers.dev`.
- Enable zone image transformations; keep **"any origin" OFF** and restrict the sources
  allowlist to our zone with path prefix `/origin/`
  ([sources docs](https://developers.cloudflare.com/images/optimization/transformations/sources/)),
  so the zone's transform endpoint can't be aimed at other same-zone paths or third-party URLs.
- WAF rate-limiting rule on `/origin/*` (hygiene — see Q5).
- Billing/usage notification on Images unique transformations (see residual risks).

## The open questions, resolved

**Q1 — Token lifecycle: rotate on every publish.** Unpublish clears the token; re-publish
mints a new one. A link shared during an earlier public period is dead forever, even if the
photo goes public again. Rotation is the revocation primitive; the DB flag alone can't be,
because the edge cache serves without consulting the origin.

**Q2 — Expiring signed URLs: no.** The embed use case (paste into a forum post) requires
URLs that stay valid indefinitely while the photo is public; expiry breaks exactly the
supported scenario. Signatures also add nothing while a cached copy exists, since cache hits
never reach the origin to be validated. Flag + rotation + purge is the revocation model.

**Q3 — Purge propagation: effectively instant, one URL.** Docs: purged files are *"instantly
removed … across all data centers"*; Cloudflare's Instant Purge blog reports ~250 ms p50 for
single-file purge (blog-only figure, not contractual). No tiered-cache caveat is documented
for single-file purge. The real residual window is **browser caches**, which no purge can
reach — bounded by the origin route's `max-age=86400` (1 day). Tighten to `max-age=3600`
(the documented 1-hour edge minimum) if a 1-day browser window ever feels too long; Images
billing is deduped per calendar month by uniqueness, not by cache state, so shorter TTLs cost
only extra origin refetches (binding calls), not extra unique-transform charges.

**Q4 — Direct origin-route access: assume it, design for it.** The transformation subrequest
does carry `image-resizing` in the `Via` header, but the docs present that check only for
loop prevention/rewrite-rule routing — there is *no* documented guarantee Cloudflare strips a
client-forged `Via: image-resizing`, so it is not a security boundary. And the origin URL is
plainly visible inside every public `/cdn-cgi/image/` URL anyway. Therefore the origin route
must be safe to serve to anyone holding the token:

- it serves a **capped rendition** (≤2560 px, re-encoded), never the R2 original;
- it strips metadata (`metadata: "none"`) — the library stores GPS EXIF, and public bytes
  must not leak location;
- optionally log requests missing the `Via` marker as an anomaly signal (defense-in-depth
  telemetry, not a gate).

The binding transform inside the origin route bills per call, but the route is only reached
on edge-cache fills (~once per source per TTL), so the cost is noise.

**Q5 — Rate limiting: hygiene, not load-bearing.** 128-bit random tokens make enumeration
infeasible (guessing is ~2^127 requests); access control does not depend on rate limits. Still
add a WAF rate rule on `/origin/*` (e.g. throttle IPs generating sustained 404s) to keep
scanning noise cheap, and rely on the existing session gate + Cloudflare defaults for
`/api/**`.

**Q6 — Observability: log the origin route, accept blindness at the edge.** Origin-route hits
are rare by construction (cache fills only), so log every one (Workers observability is
already enabled) with token + `Via` presence + colo. A token generating origin hits far above
its variant count × TTL cadence is the anomaly to alert on. True view counts live only in
zone analytics because cache hits never reach the Worker — acceptable for a personal site.

**Q7 — Cost model.** Private path with Cache API: binding calls only on per-PoP,
per-eviction cold misses; a full cold browse of a 2,000-photo library at 3 sizes is ~6,000
calls ≈ $0.50 once, steady state ≈ $0 (first 5,000/month free). Public path: unique
transformations = photos × requested sizes, deduped per calendar month — a few hundred
public photo-sizes is well inside the free tier; origin-route binding calls ≈ one per photo
per day. Expected total: **$0–1/month**.

## Residual risks (accepted)

1. **Browser-cached copies survive unpublish** for up to `max-age` (1 day). Unavoidable
   without breaking embed caching entirely.
2. **Public is public**: anyone who ever loaded the photo can save/rehost it. Revocation only
   stops *our* infrastructure from serving it.
3. **Billing abuse on known public URLs**: options are client-controlled, so an adversary can
   mint unique transformations (`width=1..n`) at $0.50/1,000. Sources path restriction doesn't
   prevent this (the source is legitimate). Bounded by the usage notification above; a WAF
   rule constraining `/cdn-cgi/image/` option strings is the escalation if ever needed.
4. Purge latency figures are from Cloudflare's blog, not docs — treat "instant" as
   seconds-scale, not a contractual SLO.
