// Detach one or more tags from a photo. The tags themselves are untouched.
// Ids ride in the query string (?tagIds=a,b), not a JSON body: in the nitro
// cloudflare_module build the request body is never pumped to the handler for a
// DELETE (see folders/[id]/photos.delete.ts for the full explanation), so query
// params are the correct shape here.
export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id") as string;
	const raw = getQuery(event).tagIds;
	const tagIds = (typeof raw === "string" ? raw.split(",") : [])
		.map((t) => t.trim())
		.filter(Boolean);
	if (tagIds.length === 0) {
		throw createError({ statusCode: 400, statusMessage: "tagIds is required" });
	}

	const db = useDB(event);
	await requirePhoto(db, id);

	await db.batch(
		tagIds.map((tagId) =>
			db
				.prepare("DELETE FROM photo_tags WHERE tag_id = ? AND photo_id = ?")
				.bind(tagId, id),
		),
	);

	return { ok: true, removed: tagIds.length };
});
