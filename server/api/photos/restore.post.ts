// Batch-restore: clear deleted_at on every given tombstoned photo so they return
// to the live library. Mirrors photos/[id]/restore.post.ts. Never re-publishes
// (visibility/token were cleared on delete and stay cleared). Only touches
// currently-trashed rows; unknown/live ids drop out. Ids ride in the JSON body.
//
// Response: { ok: true, restored: <count>, ids: [...] } — the actually-restored ids.
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
			`UPDATE photos SET deleted_at = NULL
			 WHERE deleted_at IS NOT NULL AND id IN (${placeholders})
			 RETURNING id`,
		)
		.bind(...ids)
		.all<{ id: string }>();
	const affected = results ?? [];
	return {
		ok: true,
		restored: affected.length,
		ids: affected.map((r) => r.id),
	};
});
