// Batch set the favorite flag on many photos in one D1 write. Unlike the
// per-photo toggle (photos/[id]/favorite.post.ts), this takes an explicit
// boolean `value` so a bulk action is deterministic (set-all-true or
// set-all-false), never a per-item flip. Ids ride in the JSON body (POST, so
// the CF DELETE-body quirk doesn't apply). Unknown ids simply drop out.
//
// Response: { ok: true, updated: <count>, ids: [...] } — the actually-changed ids.
export default defineEventHandler(async (event) => {
	const body = await readBody<{ ids?: unknown; value?: unknown }>(event);
	const ids = Array.isArray(body?.ids)
		? body.ids.filter((s): s is string => typeof s === "string")
		: [];
	if (ids.length === 0) {
		throw createError({ statusCode: 400, statusMessage: "ids is required" });
	}
	const value = body?.value ? 1 : 0;

	const db = useDB(event);
	const placeholders = ids.map(() => "?").join(",");
	const { results } = await db
		.prepare(
			`UPDATE photos SET is_favorite = ?
			 WHERE id IN (${placeholders})
			 RETURNING id`,
		)
		.bind(value, ...ids)
		.all<{ id: string }>();
	const affected = results ?? [];
	return { ok: true, updated: affected.length, ids: affected.map((r) => r.id) };
});
