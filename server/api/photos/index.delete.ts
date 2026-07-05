// Batch-delete photos in a single D1 write. Two modes:
//   default        soft delete — tombstone every given id (set deleted_at) so the
//                  photos drop out of every normal listing but survive for Trash.
//   ?purge=1       permanent delete — drop the R2 objects + all D1 rows for the
//                  given ids. Only already-tombstoned rows are purged.
//
// Ids ride in the query string (?ids=a,b,c), not a JSON body: in the nitro
// cloudflare_module build the request body is never pumped to a DELETE handler
// (see folders/[id]/photos.delete.ts for the full explanation), so query params
// are the correct shape here. Unknown ids are ignored — the op is idempotent.
//
// Response: { ok: true, deleted: <count>, ids: [...] } (or `purged` in purge mode).
export default defineEventHandler(async (event) => {
	const raw = getQuery(event).ids;
	const ids = (typeof raw === "string" ? raw.split(",") : [])
		.map((s) => s.trim())
		.filter(Boolean);
	if (ids.length === 0) {
		throw createError({ statusCode: 400, statusMessage: "ids is required" });
	}

	const db = useDB(event);
	const placeholders = ids.map(() => "?").join(",");
	const purge = getQuery(event).purge;
	const isPurge = purge === "1" || purge === 1 || purge === true;

	if (isPurge) {
		// Permanent purge — only touch already-tombstoned rows. Collect their R2
		// keys, then let the shared helper drop bytes + all D1 rows in one batch.
		const { results } = await db
			.prepare(
				`SELECT id, r2_key FROM photos
				 WHERE deleted_at IS NOT NULL AND id IN (${placeholders})`,
			)
			.bind(...ids)
			.all<{ id: string; r2_key: string }>();
		const rows = results ?? [];
		await purgePhotos(db, useBucket(event), rows);
		return { ok: true, purged: rows.length, ids: rows.map((r) => r.id) };
	}

	// Soft delete: tombstone every live row in a single statement. Only touch live
	// rows (deleted_at IS NULL) so a repeat delete doesn't reset the timestamp;
	// RETURNING gives the actually-affected ids (unknown ids simply drop out).
	const { results } = await db
		.prepare(
			`UPDATE photos SET deleted_at = datetime('now')
			 WHERE deleted_at IS NULL AND id IN (${placeholders})
			 RETURNING id`,
		)
		.bind(...ids)
		.all<{ id: string }>();
	const affected = results ?? [];
	return { ok: true, deleted: affected.length, ids: affected.map((r) => r.id) };
});
