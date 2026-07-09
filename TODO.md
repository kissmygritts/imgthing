# TODO

## Viewer: Dimensions row doesn't reflect the self-heal until a full page refresh

**Status:** open
**Effort:** S (~30–45 min, single file)
**Area:** `app/components/PhotoViewer.vue` (frontend only — no API/DB/migration change)
**Priority:** low (cosmetic; data is correct in the DB, only the open viewer is stale)

### Symptom

Open a photo whose `width`/`height` were null (a pre-`0010` upload, or one whose
EXIF declared no dimensions). The **Dimensions** row in the metadata drawer shows
`—`. It stays `—` while the viewer is open — navigating to the next photo and back
does **not** fill it in. Only a full page refresh shows the real dimensions.

### Why it happens

The server-side self-heal already works: `GET /api/photos/:id`
(`server/api/photos/[id]/index.get.ts`) measures the original via
`imageDimensions()` (Images binding `info()`), **persists** `width`/`height` to
`exif_data`, and returns the fresh values. The viewer calls this endpoint lazily
per photo via `loadRawExif(id)`.

The gap is purely client-side data flow:

- `photo` is `computed(() => props.photos[props.index])` — the **list row** from
  `GET /api/photos` (`useLibrary`'s `photos` state). See `PhotoViewer.vue:124`.
- The **Dimensions** fact reads `p.width` / `p.height` off that list row
  (`PhotoViewer.vue:229-232`).
- `loadRawExif` (`PhotoViewer.vue:340`) fetches the detail response but **only
  extracts `other_data`** — it throws away the `width`/`height` the endpoint
  returns. So the freshly-healed values never reach the open viewer.
- The list row is only refreshed on a full `refreshNuxtData(["photos"])` (page
  load / library refresh), which is why a refresh "fixes" it.

Navigating away and back re-runs `loadRawExif` but hits the same dead end — the
detail response's dimensions are still discarded, and `props.photos[index]` is
unchanged.

### Fix (recommended: apply the detail response as a local override)

In `loadRawExif`, capture `width`/`height` from the detail response and hold them
in a local reactive override; have the Dimensions fact prefer the override when
the list row is null. Sketch:

1. Extend the `PhotoDetail` interface (`PhotoViewer.vue:333`) to include
   `width?: number | null; height?: number | null`.
2. Add `const healedDims = ref<{ id: string; width: number; height: number } | null>(null)`.
3. In `loadRawExif`, after the `photo.value?.id !== id` guard, if the response has
   numeric `width`/`height`, set `healedDims.value = { id, width, height }`.
   Reset it to `null` at the top alongside `rawExif.value = null` so a stale
   override never bleeds across photos.
4. In the Dimensions fact, use `p.width ?? (healedDims.value?.id === p.id ? healedDims.value.width : null)`
   (same for height).

This keeps the list row as the source of truth and layers the healed value on
top only for the currently-open photo. No API change.

### Alternative (heavier, not recommended for this)

Push the healed dimensions back into `useLibrary`'s `photos` state so the list
row itself updates (a small mutation on the matching row). More correct globally
(the gallery would also reflect it), but it couples the viewer to library
internals and isn't worth it for a value only surfaced in the drawer. Revisit
only if other detail-only fields need the same treatment.

### Not in scope / already handled

- **Existing rows backfill:** handled lazily server-side on first detail open, and
  by migration `0010`'s `json_extract` pass for EXIF-declared dimensions. No
  websockets/polling needed — the DB is correct after one open; this TODO is only
  about the *open viewer* not re-reading it.
- **New uploads:** already correct — upload captures true dimensions via
  `imageDimensions()` and the list row carries them from the start.

### Verify after fixing

Reproduce with a null-dimension photo:
1. In local D1: `UPDATE exif_data SET width=NULL, height=NULL WHERE photo_id='<id>'`.
2. Open that photo in the viewer → Dimensions shows `—`, then fills in **without a
   refresh** once the detail fetch resolves (a beat after open).
3. Confirm the integration self-heal test still passes
   (`test/integration/photoDetail.test.ts` — "self-heals null dimensions").
