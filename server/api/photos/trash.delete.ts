// Empty trash: permanently remove every tombstoned photo — each R2 object plus a
// full D1 cleanup (exif_data, folder_photos, photo_tags, photos). Resilient to
// already-missing R2 bytes. Returns the count purged.
//
// Nitro routes the static `trash` segment ahead of the dynamic `[id]`, so this
// resolves before DELETE /api/photos/[id] for the literal /api/photos/trash path.
export default defineEventHandler(async (event) => {
	const db = useDB(event);

	const { results } = await db
		.prepare("SELECT id, r2_key FROM photos WHERE deleted_at IS NOT NULL")
		.all<{ id: string; r2_key: string }>();

	const rows = results ?? [];
	await purgePhotos(db, useBucket(event), rows);

	return { ok: true, purged: rows.length };
});
