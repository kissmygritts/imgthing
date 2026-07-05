// Stream a photo's original bytes from R2. Cloudflare Images variants come in M6;
// for now this serves the untransformed original.
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
