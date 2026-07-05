// Fully delete a photo: drop the R2 object first, then clear all D1 rows
// (exif_data, folder_photos memberships, and the photos row itself). Resilient
// to a missing R2 object — if the bytes are already gone we still clean up D1.
export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id");
	if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

	const db = useDB(event);
	const row = await db
		.prepare("SELECT r2_key FROM photos WHERE id = ?")
		.bind(id)
		.first<{ r2_key: string }>();
	if (!row) throw createError({ statusCode: 404, statusMessage: "Not found" });

	// R2 first. delete() is idempotent (no error if the key is already gone),
	// but guard anyway so a transient R2 error still lets D1 cleanup proceed.
	await useBucket(event)
		.delete(row.r2_key)
		.catch(() => {});

	await db.batch([
		db.prepare("DELETE FROM exif_data WHERE photo_id = ?").bind(id),
		db.prepare("DELETE FROM folder_photos WHERE photo_id = ?").bind(id),
		db.prepare("DELETE FROM photos WHERE id = ?").bind(id),
	]);

	return { ok: true };
});
