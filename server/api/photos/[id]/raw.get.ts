// Stream a photo's original bytes from R2 — the full, untransformed original.
// Precomputed WebP variants (thumbnail/medium/large) live in R2 at variants/{id}/{size}
// and are served by variant.get.ts and the public /p/{token}/{size} route.
export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id");
	if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

	const row = await useDB(event)
		.prepare("SELECT r2_key, content_type FROM photos WHERE id = ?")
		.bind(id)
		.first<{ r2_key: string; content_type: string }>();
	if (!row) throw createError({ statusCode: 404, statusMessage: "Not found" });

	const object = await useBucket(event).get(row.r2_key);
	if (!object) {
		throw createError({ statusCode: 404, statusMessage: "Object missing" });
	}

	setHeader(event, "content-type", row.content_type);
	setHeader(event, "cache-control", "private, max-age=31536000, immutable");
	setHeader(event, "etag", object.httpEtag);
	return object.body;
});
