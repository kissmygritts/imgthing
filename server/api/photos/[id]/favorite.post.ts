// Toggle a photo's favorite flag. Flips is_favorite (0 <-> 1) in a single
// statement and returns the new state. 404 if the photo doesn't exist.
export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id");
	if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

	const db = useDB(event);
	const row = await db
		.prepare(
			"UPDATE photos SET is_favorite = 1 - is_favorite WHERE id = ? RETURNING is_favorite",
		)
		.bind(id)
		.first<{ is_favorite: number }>();
	if (!row) throw createError({ statusCode: 404, statusMessage: "Not found" });

	return { id, is_favorite: row.is_favorite };
});
