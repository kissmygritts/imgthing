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
defineRouteMeta({
	openAPI: {
		tags: ["Photos"],
		summary: "Batch delete photos",
		description:
			"Batch soft-delete (tombstone) photos, or permanently purge already-tombstoned ones with `?purge=1`. Ids ride in the query string (`?ids=a,b,c`), never a JSON body — the nitro cloudflare_module build never pumps a request body to a DELETE handler. Unknown ids are ignored; the op is idempotent.",
		security: [{ sessionCookie: [] }],
		parameters: [
			{
				name: "ids",
				in: "query",
				required: true,
				description: "Comma-separated photo ids.",
				schema: { type: "string" },
			},
			{
				name: "purge",
				in: "query",
				description:
					'"1" to permanently drop R2 bytes + D1 rows (only already-tombstoned rows are purged). Otherwise soft-delete.',
				schema: { type: "string", enum: ["1"] },
			},
		],
		responses: {
			"200": {
				description:
					"Affected ids and a count. In purge mode the count key is `purged`; otherwise `deleted`.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								ok: { type: "boolean" },
								deleted: { type: "integer" },
								purged: { type: "integer" },
								ids: { type: "array", items: { type: "string" } },
							},
						},
					},
				},
			},
			"400": { description: "`ids` is required." },
		},
	},
});

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
			`UPDATE photos SET deleted_at = datetime('now'),
			 visibility = 'private', public_token = NULL, published_at = NULL
			 WHERE deleted_at IS NULL AND id IN (${placeholders})
			 RETURNING id`,
		)
		.bind(...ids)
		.all<{ id: string }>();
	const affected = results ?? [];
	return { ok: true, deleted: affected.length, ids: affected.map((r) => r.id) };
});
