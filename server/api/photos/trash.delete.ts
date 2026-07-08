// Empty trash: permanently remove every tombstoned photo — each R2 object plus a
// full D1 cleanup (exif_data, folder_photos, photo_tags, photos). Resilient to
// already-missing R2 bytes. Returns the count purged.
//
// Nitro routes the static `trash` segment ahead of the dynamic `[id]`, so this
// resolves before DELETE /api/photos/[id] for the literal /api/photos/trash path.
defineRouteMeta({
	openAPI: {
		tags: ["Photos"],
		summary: "Empty trash",
		description:
			"Permanently remove every tombstoned photo — each R2 object plus a full D1 cleanup (exif_data, folder_photos, photo_tags, photos). Takes no parameters: it purges all trashed rows. Resilient to already-missing R2 bytes.",
		security: [{ sessionCookie: [] }],
		responses: {
			"200": {
				description: "The number of photos purged.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								ok: { type: "boolean" },
								purged: { type: "integer" },
							},
						},
					},
				},
			},
		},
	},
});

export default defineEventHandler(async (event) => {
	const db = useDB(event);

	const { results } = await db
		.prepare("SELECT id, r2_key FROM photos WHERE deleted_at IS NOT NULL")
		.all<{ id: string; r2_key: string }>();

	const rows = results ?? [];
	await purgePhotos(db, useBucket(event), rows);

	return { ok: true, purged: rows.length };
});
