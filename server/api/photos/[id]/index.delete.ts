// Delete a photo. Two modes:
//   default        soft delete — set deleted_at so the photo drops out of every
//                  normal listing but survives in R2/D1 (recoverable from Trash).
//   ?purge=1       permanent delete — drop the R2 object + all D1 rows. Only a
//                  tombstoned (already-trashed) photo can be purged.
// Both return { ok: true }; a missing row 404s.
defineRouteMeta({
	openAPI: {
		tags: ["Photos"],
		summary: "Delete photo",
		description:
			"Soft-delete (tombstone) a photo by default, or permanently purge R2 object + D1 rows with `?purge=1` (only allowed on an already-trashed photo).",
		security: [{ sessionCookie: [] }],
		parameters: [
			{ name: "id", in: "path", required: true, schema: { type: "string" } },
			{
				name: "purge",
				in: "query",
				required: false,
				description:
					"Set to `1` to permanently purge an already-tombstoned photo.",
				schema: { type: "string" },
			},
		],
		responses: {
			"200": {
				description: "Photo deleted (or purged).",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: { ok: { type: "boolean" } },
						},
					},
				},
			},
			"400": { description: "Missing id." },
			"404": { description: "Photo not found (or not tombstoned, on purge)." },
		},
	},
});

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id");
	if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

	const db = useDB(event);
	const q = getQuery(event);
	const purge = q.purge === "1" || q.purge === 1 || q.purge === true;

	if (!purge) {
		// Soft delete: tombstone the row. Only touch live rows so a repeat delete
		// doesn't reset the timestamp, but still 404 a genuinely missing photo.
		const row = await db
			.prepare(
				"UPDATE photos SET deleted_at = datetime('now'), visibility = 'private', public_token = NULL, published_at = NULL WHERE id = ? AND deleted_at IS NULL RETURNING id",
			)
			.bind(id)
			.first<{ id: string }>();
		if (!row) {
			// Distinguish "already trashed" (idempotent ok) from "never existed" (404).
			await requirePhoto(db, id);
		}
		return { ok: true };
	}

	// Permanent purge — only allowed on an already-tombstoned row.
	const row = await db
		.prepare(
			"SELECT r2_key FROM photos WHERE id = ? AND deleted_at IS NOT NULL",
		)
		.bind(id)
		.first<{ r2_key: string }>();
	if (!row) throw createError({ statusCode: 404, statusMessage: "Not found" });

	await purgePhotos(db, useBucket(event), [{ id, r2_key: row.r2_key }]);
	return { ok: true };
});
