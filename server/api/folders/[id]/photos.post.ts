// Add one or more photos to a folder. Idempotent: already-present pairs are
// ignored. A photo may live in many folders.
export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id") as string;
	const body = await readBody<{ photoIds?: unknown }>(event);
	const photoIds = Array.isArray(body?.photoIds)
		? body.photoIds.filter((p): p is string => typeof p === "string")
		: [];
	if (photoIds.length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "photoIds is required",
		});
	}

	const db = useDB(event);
	await requireFolder(db, id);

	await db.batch(
		photoIds.map((photoId) =>
			db
				.prepare(
					"INSERT OR IGNORE INTO folder_photos (folder_id, photo_id) VALUES (?, ?)",
				)
				.bind(id, photoId),
		),
	);

	return { ok: true, added: photoIds.length };
});
