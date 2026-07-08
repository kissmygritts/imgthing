// Batch-unpublish: clear visibility/token/published_at for every given photo in
// one D1 write. Dropping the token is the whole revocation (variants stay in R2
// for the private path). Idempotent on already-private rows; unknown ids drop
// out. Ids ride in the JSON body.
//
// Response: { ok: true, unpublished: <count>, ids: [...] } — the actually-cleared ids.
export default defineEventHandler(async (event) => {
	const body = await readBody<{ ids?: unknown }>(event);
	const ids = Array.isArray(body?.ids)
		? body.ids.filter((s): s is string => typeof s === "string")
		: [];
	if (ids.length === 0) {
		throw createError({ statusCode: 400, statusMessage: "ids is required" });
	}

	const db = useDB(event);
	const placeholders = ids.map(() => "?").join(",");
	const { results } = await db
		.prepare(
			`UPDATE photos
			 SET visibility = 'private', public_token = NULL, published_at = NULL
			 WHERE visibility = 'public' AND id IN (${placeholders})
			 RETURNING id`,
		)
		.bind(...ids)
		.all<{ id: string }>();
	const affected = results ?? [];
	return {
		ok: true,
		unpublished: affected.length,
		ids: affected.map((r) => r.id),
	};
});
