// Batch-publish: mint a fresh public token for each given photo that isn't
// already public. Mirrors photos/[id]/publish.post.ts (rotation = revocation),
// but deliberately leaves already-published photos untouched — no token rotation
// on the bulk path, so an existing share URL never breaks as a side effect.
// Only live (non-trashed) rows are affected. Every published photo gets its OWN
// token, so this is a per-id batch of UPDATEs. show_location defaults to 0 (never
// leak GPS on an implicit bulk publish). Ids ride in the JSON body.
//
// Response: { ok: true, published: <count>, ids: [...] } — the newly-published ids.
export default defineEventHandler(async (event) => {
	const body = await readBody<{ ids?: unknown }>(event);
	const ids = Array.isArray(body?.ids)
		? body.ids.filter((s): s is string => typeof s === "string")
		: [];
	if (ids.length === 0) {
		throw createError({ statusCode: 400, statusMessage: "ids is required" });
	}

	const db = useDB(event);
	const batchResults = await db.batch<{ id: string }>(
		ids.map((id) =>
			db
				.prepare(
					`UPDATE photos
					 SET visibility = 'public', public_token = ?, published_at = datetime('now'), show_location = 0
					 WHERE id = ? AND deleted_at IS NULL AND visibility != 'public'
					 RETURNING id`,
				)
				.bind(generatePublicToken(), id),
		),
	);
	const published = batchResults.flatMap((r) => r.results ?? []);
	return {
		ok: true,
		published: published.length,
		ids: published.map((r) => r.id),
	};
});
