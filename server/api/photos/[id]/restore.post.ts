// Restore a tombstoned photo: clear deleted_at so it returns to the live library.
// Idempotent on an already-live photo; 404 if the row doesn't exist at all.
export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id");
	if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

	const db = useDB(event);
	await requirePhoto(db, id);

	await db
		.prepare("UPDATE photos SET deleted_at = NULL WHERE id = ?")
		.bind(id)
		.run();

	return { ok: true };
});
