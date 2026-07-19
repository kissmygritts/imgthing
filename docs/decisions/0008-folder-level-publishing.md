# ADR 0008 — Folder-level publishing (public galleries)

**Status:** Accepted · 2026-07 — design locked, implementation pending. Forward-looking (this repo's
ADRs usually record post-implementation reality; this one was landed *before* the build per
[issue #7](https://github.com/kissmygritts/imgthing/issues/7), which required its own ADR first).
Extends the per-photo serving model in
[ADR 0005](0005-precomputed-variants-from-r2.md) (which carries [ADR 0004](0004-public-photo-serving.md)'s
token/uniform-404/private-bucket invariants) to folder granularity. Vocabulary added to
[`CONTEXT.md`](../../CONTEXT.md) (Publishing & sharing).

## Context

Today a single photo can be published: the owner mints a 32-hex `public_token`, and the
`server/routes/p/[token]/**` routes serve capped WebP variants + EXIF meta over a permanently
private bucket, with a uniform bare-404 for every failure. There is **no public HTML page** — the
share surface is raw image URLs + embed snippets in `PhotoViewer.vue`.

Issue #7 wants to publish a whole **folder** as one shareable **public gallery** — a browsable page,
not a pile of individually-published photos. This was deferred from ADR 0005 as security-sensitive.
This ADR locks the design and resolves its open questions. It **deliberately supersedes the issue's
"opt-in nesting" design lean** (see Decision → Membership).

## Decision

**Publish a folder under its own token, serving its direct member photos through one public gallery
page.** The folder token is an independent credential — it bypasses each member photo's own
`visibility`. Reuse the per-photo variant objects and serving discipline unchanged; add a folder
token layer on top.

### Terminology (see CONTEXT.md)

- **folder** — the existing container, unchanged.
- **publishing a folder** / **published folder** — the owner-side act/state.
- **public gallery** — the visitor-facing page a folder token resolves to. _Avoid_: album, public
  folder.

### Schema (migration `0011_publish_folders.sql`)

Mirror `0006_public_photos.sql`, minus everything ruled out:

```sql
ALTER TABLE folders ADD COLUMN visibility   TEXT NOT NULL DEFAULT 'private';
ALTER TABLE folders ADD COLUMN public_token TEXT;
ALTER TABLE folders ADD COLUMN published_at TEXT;
CREATE UNIQUE INDEX idx_folders_public_token ON folders (public_token);
```

`public_token` reuses `generatePublicToken()` (16 random bytes, 32-char hex, 128 bits) — the only
credential, never derived from the folder id. **No** `show_location` (GPS stays per-photo), **no**
`include_subfolders` (no nesting), **no** stored slug (the URL slug is cosmetic), **no**
`variants_generated_at` (folders own no bytes).

### Membership — direct only, resolved live

- **No nesting.** A published folder exposes only its **direct** `folder_photos` members. The member
  query is a flat join on one `folder_id`; there is no recursion and no `include_subfolders` flag.
  This **supersedes issue #7's opt-in-nesting lean.** To share a nested structure, publish each
  folder separately — each gets its own token and gallery; a subfolder is invisible to its parent's
  gallery.
- **Live resolution, stable token.** Membership is resolved per-request from `folder_photos` — never
  snapshotted. Adding/removing a photo (or trashing/purging it) changes the gallery immediately, and
  the token is **not** rotated. Emptying a folder leaves it published (empty-state gallery); no
  auto-unpublish.
- **Union exposure.** A photo in ≥1 published folder is public through that gallery regardless of its
  own private flag or the other folders it belongs to. This is the sharp edge of the independent read
  path; the UI must warn on publish (below).

### Routes

Token rides the **query string** (`?token=`, natural for a shared link, cacheable on Cloudflare;
same `/^[0-9a-f]{32}$/` shape guard). The `{slug}` path segment is **cosmetic** — resolution is by
token, so a stale slug after a rename still resolves (Notion-style). The name in the URL is therefore
public (see residual risks).

**Public, unauthenticated — Nitro routes (`server/routes/f/**`).** Public-by-construction (outside
`/api`, so `server/middleware/auth.ts` skips; outside the page router, so `auth.global.ts` never sees
them). Every failure → `publicNotFound()` (bare `Response`, never `createError` — the ADR 0005
200-app-shell trap).

- `GET /f/{slug}/list?token=` — the single token-resolution point. Returns the whitelisted manifest
  `{ folderName, photos: [{ id, filename }] }`, ordered `taken_at desc` (fallback `uploaded_at`),
  trashed + non-members excluded. **Never emits `r2_key`**; no EXIF/GPS (deferred).
- `GET /f/{slug}/{photoId}/{size}?token=` — serves one WebP via `getOrCreateVariant` (same per-photo
  R2 objects, self-heal) **only after** the membership query proves the photo is a live member:

  ```sql
  SELECT p.id, p.r2_key
  FROM photos p
  JOIN folder_photos fp ON fp.photo_id = p.id
  JOIN folders f        ON f.id = fp.folder_id
  WHERE f.public_token = ? AND f.visibility = 'public'
    AND p.id = ? AND p.deleted_at IS NULL
  ```

**Public gallery page — Nuxt SSR page.**

- `GET /f/{slug}?token=` → `app/pages/f/[slug].vue`. Server-renders the gallery (header: name +
  count; thumbnail grid; lightbox showing the `lg` WebP; wordplate footer). Fetches `/list`; throws
  `createError({ statusCode: 404 })` on failure. Requires a one-line allowlist for the `/f/` prefix
  in `app/middleware/auth.global.ts`. Chosen over a bare-HTML Nitro route so the gallery reuses the
  Bright Studio Glass components — the 200-app-shell trap is a **Nitro-route** failure mode, not a
  page one (pages set the thrown status; `app/pages/dev/shell.vue` already relies on this). The
  assumption that the page returns a *real* 404 on the Cloudflare build is verified by test, not
  trusted (see below).

**Gated JSON API — owner-side (`server/api/folders/[id]/**`).** Session-gated, `defineRouteMeta`
OpenAPI annotations (`security: [{ sessionCookie: [] }]`), integration-tested. The public `/f/**`
routes stay **out** of OpenAPI, exactly like `/p/**`.

- `POST /api/folders/{id}/publish` — mint token (**idempotent**: if already public, return the
  existing token — no rotation), set `visibility='public'`, `published_at=now`; return the
  `/f/{slug}?token=` share link. Deliberately diverges from the per-photo "rotate on every publish"
  (photos rotate because `show_location` re-publishes; folders have no such per-publish setting, and
  a stable link should not silently break).
- `POST /api/folders/{id}/unpublish` — clear `public_token`/`visibility`/`published_at`. This is the
  revocation primitive. No batch route (publishing is one folder at a time).

### Serving & lifecycle invariants (hold these)

- **Uniform bare-404** on every `/f/**` Nitro failure (bad token shape, no folder, not public,
  non-member id, trashed photo, bad size, serving error) via `publicNotFound()`.
- **Public bytes carry no EXIF/GPS** — variants are WebP re-encodes (strip EXIF natively). GPS is
  moot in v1 (no meta route); when meta lands it follows each photo's own `show_location`.
- **`photoId ∈ folder` on every byte request** — the membership join above; without it the token is a
  bearer credential for any photo id. Exposing member photo `id`s in the manifest/URLs is safe
  because of this re-check.
- **`deleted_at IS NULL` everywhere** — the token bypasses `visibility`, never soft-delete.
- **No handler changes for delete/purge/detach.** Folder hard-delete already cascades the folder row
  → the token vanishes with it (free revocation; folders stay hard-delete-only). Photo
  soft-delete/purge/detach drop the photo from the live membership query.

### UI (owner-side)

- **Entry point** — a **"Share…"** item in the `FolderTree.vue` per-folder dropdown (beside New
  subfolder / Rename / Delete).
- **Control** — a **share dialog** (`.glass-popout`), the folder-scoped mirror of the PhotoViewer
  share screen: Public on/off toggle, copy-able `/f/{slug}?token=` link, unpublish. No embed snippets
  (a folder shares one link).
- **Exposure warning — prominent, non-negotiable.** e.g. _"Publishing shares every photo in this
  folder through one public link — including photos marked private. Any photo you add later becomes
  public immediately."_
- **Published glyph** on published folders in the tree.
- **Wiring** — `publishFolder`/`unpublishFolder` in `useLibrary.ts` (mirroring
  `publishPhoto`/`unpublishPhoto`, optimistic); `server/api/folders/index.get.ts` + the `FolderNode`
  interface carry the 3 new columns.

### v1 scope

Grid + lightbox + wordplate footer. **Deferred:** EXIF/GPS and the per-photo `/meta` route; a
toolbar "Share" button when folder-scoped; batch publish.

## The open questions, resolved

- **Nesting → none.** Direct members only; publish each folder separately for a nested share.
  Supersedes issue #7's opt-in-nesting lean. Kills the recursive CTE and the `include_subfolders`
  column.
- **Token lifecycle → stable.** Membership changes never rotate; publish is idempotent; unpublish (or
  folder delete) is the only revocation. Diverges from the per-photo rotate-on-publish, deliberately.
- **Gallery rendering → Nuxt SSR page, not bare HTML.** Reuses components; the 200-shell trap is
  route-specific, not page-specific. The byte/list serving stays on the proven Nitro pattern.
- **Trash exclusion under a folder token → always.** `deleted_at IS NULL` on every member query; the
  token bypasses `visibility` only.
- **Slug → cosmetic, unstored.** Resolution is by token; the pretty name is derived live and may go
  stale after a rename.

## Residual risks (accepted)

1. **The Nuxt-page 404 is the one unproven assumption.** If a page's SSR `createError(404)` returns a
   200 app-shell on this Cloudflare build (the exact bug ADR 0005 was scarred by, but for routes),
   the fallback is a bare-HTML Nitro gallery route. **Gating test:** `SELF.fetch("/f/x?token=bad")`
   → assert `status === 404`.
2. **The folder name is public in the URL** (link, history, Referer, CF logs). The per-photo model
   leaks nothing; this is a deliberate step back for a friendlier link. Rename the folder to change
   it; the old slug still resolves by token regardless.
3. **Instant exposure by design.** Adding a photo to a published folder makes it public with no
   further action. Mitigation is the publish-time warning, not a technical gate.
4. **Public is public.** Anyone who loaded a gallery photo can save/rehost the WebP; revocation only
   stops *our* infrastructure from serving it. Originals are never served.
5. **Union exposure.** A photo private everywhere else is still public through any published folder it
   belongs to.

## Definition of done (test surface)

Integration tests (`@cloudflare/vitest-pool-workers`, real bindings):

- **API** — publish mints a token; unpublish clears it; re-publish is idempotent (same token);
  publish on a missing/deleted folder → 404. OpenAPI annotations present (unit gate).
- **List route** — valid token → members only (excludes trashed + non-members); bad/unpublished
  token → bare 404.
- **Byte route** — valid member → WebP; non-member id → 404; trashed photo → 404; bad size/token →
  404; self-heal on R2 miss.
- **Page** — bad token → `status === 404` (risk #1); valid token → 200 + HTML containing the folder
  name.
- **Independence** — a private photo served through a published folder's token → 200, while its authed
  `/api/photos/[id]/variant` still 401s without a session.
