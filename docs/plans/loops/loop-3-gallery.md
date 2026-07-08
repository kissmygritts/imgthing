# Loop 3 — Gallery UX (bulk actions)

**Items:** #5 bulk multi-select actions.
**Human input:** low. Single-item loop.
Follow the [loop protocol](./README.md#the-loop-protocol-applies-to-every-plan-here): one subagent,
gate must pass, one commit (or split into per-action commits — see below).

> **Note:** the original Batch 3 also listed "infinite scroll / pagination." Exploration confirmed it
> is **already implemented** in `app/pages/index.vue` (`useIntersectionObserver` sentinel + `loadMore`
> + `offset` paging, `index.vue:129-162`, sentinel rendered `:546-552`) and `/api/photos` already
> supports `limit`/`offset`. It is moved to TODO's **Done** section — nothing to build here.

---

## [x] Item 5 — Batch actions on multi-select

**Label:** Feature. **Effort:** M.
**Commit:** `feat: batch favorite/publish/tag actions on multi-select`
(or one commit per action group if the subagent prefers smaller commits).

### Current state (confirmed)
Selection mode already exists in `app/pages/index.vue` (`selectMode`, `selectedIds` Set, shift-click
range `:169-211`) with a teleported bulk-action bar (`:580-682`) that already wires:
- **Select-all**, **Add-to-folder**, **Remove-from-folder**, **Delete (soft)** → `runBulkDelete`.

Server batch endpoints that already exist:
- `DELETE /api/photos?ids=a,b,c` (soft-delete / `?purge=1`) — `server/api/photos/index.delete.ts`
- `POST /api/folders/[id]/photos` (body `{photoIds}`) and `DELETE .../photos?photoIds=` — folder add/remove
- `DELETE /api/photos/[id]/tags?tagIds=` — multi-tag, but **single photo**

Client batch mutations in `app/composables/useLibrary.ts`: `addPhotosToFolder`, `removePhotosFromFolder`,
`bulkDelete`, `emptyTrash`.

**Single-item only today (the gap to fill):** favorite toggle, publish, unpublish, attach-tag, restore.

### Implementation
Add batch endpoints + client mutations + bulk-bar buttons for the missing actions. Match the existing
conventions exactly.

1. **Server — new batch endpoints** (each gated by the global middleware; each gets an integration
   test). Follow the `?ids=` query-string rule for DELETE-shaped ops and body arrays for POST:
   - `POST /api/photos/favorite` (body `{ ids, value }`) OR reuse per-id — **prefer a batch endpoint**
     that sets `is_favorite` for `WHERE id IN (...)`. Decide favorite vs. unfavorite via an explicit
     `value` so bulk is deterministic (not a per-item toggle). Return `{ ok, updated, ids }`.
   - `POST /api/photos/publish` (body `{ ids }`) and `POST /api/photos/unpublish` (body `{ ids }`) —
     mint/rotate or clear tokens for each id, reusing the existing single-item publish/unpublish logic
     in `server/api/photos/[id]/publish.post.ts` / `unpublish.post.ts` (extract shared helper if
     cleaner). Preserve the token-rotation = revocation and visibility invariants; **don't** re-publish
     on any implicit path.
   - `POST /api/photos/tags` batch attach (body `{ ids, tagNames|tagIds }`) — attach the same tag(s) to
     many photos, idempotent, mirroring `photos/[id]/tags.post.ts`.
   - Use `db.batch()` for multi-row writes (pattern already in `folders/[id]/photos.delete.ts`,
     `photos/[id]/tags.delete.ts`).
   - **Batch restore** is optional here (trash view) — include `POST /api/photos/restore` (body
     `{ ids }`) if low-cost, else defer and note it.
2. **Client — `useLibrary.ts`:** add `bulkFavorite(ids, value)`, `bulkPublish(ids)`,
   `bulkUnpublish(ids)`, `bulkAttachTag(ids, names)` (+ `bulkRestore` if the endpoint lands), each a
   `$fetch` mirroring the existing single-item mutations, then `refreshAll()`/relevant `refreshNuxtData`
   keys so counts (favorites, tags, published) update.
3. **UI — bulk bar in `index.vue:580-682`:** add buttons for Favorite / Unfavorite (or a single
   Favorite toggle that sets all selected to favorited), Publish, Unpublish, and Add-tag (reuse
   whatever tag-entry UI the single-photo path uses). Keep the bar legible + operable at ~375px in both
   themes; it's teleported to `<body>`, so it must carry its own opaque/glass surface (same lesson as
   Loop 1's Sheet). After a successful action, keep or clear selection consistently with the existing
   delete flow.
4. **"Add to folder" is already done** — no work. Don't regress it.

### Verify
- Manual (`npm run dev`): select several photos → each new action applies to all of them; favorites
  filter, published state, and tag filters reflect the change immediately.
- Gate: `npm run check && npm run typecheck && npm run test:all`.
- **Integration tests** for each new endpoint (`test/integration/photos-batch-*.test.ts`): login,
  upload 2–3 PNGs, call the batch endpoint with `?ids=`/body array, assert all affected; assert the
  unauthenticated 401 case.

### Open questions
- **Q:** batch favorite — a **toggle** (flip each) or an explicit **set value**? **Default: explicit
  `value`** (Favorite-all / Unfavorite-all as two buttons, or one "Favorite" that sets true). Bulk
  toggles are confusing when the selection is mixed. Not a human blocker — implement the default. **Answer:** one favorite button that sets true. Clicking again sets false. When mixed, assume all are false, clicking sets to true. Unclicking sets to false. 
- **Q:** should bulk **publish** rotate tokens for already-published photos (revoking old links)?
  **Default: leave already-published photos untouched; only publish the unpublished ones**, to avoid
  silently breaking live share links. Worth a one-line confirm with the human if they expected
  rotate-all, but the safe default ships. **ANSWER:** the dfault is the correct implementation
- **Q:** include batch **restore** (trash view)? **Default: include if cheap, else defer** and leave a
  TODO line — not required for the item to be "done." **ANSWER:** yes batch restore is good.
