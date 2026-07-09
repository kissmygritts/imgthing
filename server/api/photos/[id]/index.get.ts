// Full detail for a single photo, including the raw `other_data` EXIF blob that
// the lean list endpoint (GET /api/photos) deliberately omits. The viewer fetches
// this lazily to render its "Full metadata" section without bloating the gallery
// list. Session-gated via server/middleware/auth.ts. 404 if the row doesn't exist.
defineRouteMeta({
	openAPI: {
		tags: ["Photos"],
		summary: "Get photo",
		description:
			"Full detail for a single photo, including the raw `other_data` EXIF blob that the lean list endpoint omits. Session-gated.",
		security: [{ sessionCookie: [] }],
		parameters: [
			{ name: "id", in: "path", required: true, schema: { type: "string" } },
		],
		responses: {
			"200": {
				description: "The photo, including full EXIF detail.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: { photo: { type: "object" } },
						},
					},
				},
			},
			"400": { description: "Missing id." },
			"404": { description: "Photo not found." },
		},
	},
});

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id");
	if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

	const db = useDB(event);
	const row = await db
		.prepare(
			`SELECT
				p.id, p.original_filename, p.r2_key, p.content_type, p.file_size,
				p.uploaded_at, p.is_favorite,
				p.visibility, p.public_token, p.show_location,
				e.camera_make, e.camera_model, e.lens_info, e.exposure,
				e.aperture, e.iso, e.focal_length, e.taken_at,
				e.gps_latitude, e.gps_longitude, e.width, e.height, e.other_data,
				(SELECT GROUP_CONCAT(fp.folder_id)
				 FROM folder_photos fp WHERE fp.photo_id = p.id) AS folder_ids,
				(SELECT GROUP_CONCAT(pt.tag_id)
				 FROM photo_tags pt WHERE pt.photo_id = p.id) AS tag_ids
			 FROM photos p
			 LEFT JOIN exif_data e ON e.photo_id = p.id
			 WHERE p.id = ?`,
		)
		.bind(id)
		.first<Record<string, unknown> & { r2_key: string }>();

	if (!row) {
		throw createError({ statusCode: 404, statusMessage: "Photo not found" });
	}

	// Self-heal missing dimensions: pre-0010 uploads (and any whose EXIF lacked
	// declared dimensions) have null width/height. Measure the original directly
	// via the Images binding and persist, so a photo backfills the first time it's
	// opened. Non-fatal — a failure just leaves the row's dimensions null.
	if (row.width == null || row.height == null) {
		try {
			const original = await useBucket(event).get(row.r2_key);
			if (original) {
				const dims = await imageDimensions(
					useImages(event),
					await original.arrayBuffer(),
				);
				if (dims) {
					await db
						.prepare(
							"UPDATE exif_data SET width = ?, height = ? WHERE photo_id = ?",
						)
						.bind(dims.width, dims.height, id)
						.run();
					row.width = dims.width;
					row.height = dims.height;
				}
			}
		} catch (err) {
			console.error(`Dimension backfill failed for photo ${id}:`, err);
		}
	}

	// r2_key is an internal detail (never handed to the client) — selected above
	// only to fetch the original for the backfill, so drop it from the response.
	const { r2_key: _r2Key, ...photo } = row;
	return { photo };
});
