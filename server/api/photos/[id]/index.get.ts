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
				p.id, p.original_filename, p.content_type, p.file_size,
				p.uploaded_at, p.is_favorite,
				p.visibility, p.public_token, p.show_location,
				e.camera_make, e.camera_model, e.lens_info, e.exposure,
				e.aperture, e.iso, e.focal_length, e.taken_at,
				e.gps_latitude, e.gps_longitude, e.other_data,
				(SELECT GROUP_CONCAT(fp.folder_id)
				 FROM folder_photos fp WHERE fp.photo_id = p.id) AS folder_ids,
				(SELECT GROUP_CONCAT(pt.tag_id)
				 FROM photo_tags pt WHERE pt.photo_id = p.id) AS tag_ids
			 FROM photos p
			 LEFT JOIN exif_data e ON e.photo_id = p.id
			 WHERE p.id = ?`,
		)
		.bind(id)
		.first();

	if (!row) {
		throw createError({ statusCode: 404, statusMessage: "Photo not found" });
	}

	return { photo: row };
});
