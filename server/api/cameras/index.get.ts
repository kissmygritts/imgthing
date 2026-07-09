// List the distinct camera models across the library with how many LIVE photos
// each took. Drives the sidebar's Cameras filter group. Tombstoned photos are
// excluded (JOIN ... AND p.deleted_at IS NULL) so counts match the gallery.
defineRouteMeta({
	openAPI: {
		tags: ["Cameras"],
		summary: "List cameras",
		description:
			"List distinct camera models across the library with the count of LIVE (non-tombstoned) photos each took. Drives the sidebar's Cameras filter group.",
		security: [{ sessionCookie: [] }],
		responses: {
			"200": {
				description: "Camera models ordered by photo count descending.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								cameras: {
									type: "array",
									items: {
										type: "object",
										properties: {
											name: { type: "string" },
											photo_count: { type: "integer" },
										},
									},
								},
							},
						},
					},
				},
			},
		},
	},
});

export default defineEventHandler(async (event) => {
	const { results } = await useDB(event)
		.prepare(
			`SELECT
				e.camera_model AS name,
				COUNT(*) AS photo_count
			 FROM exif_data e
			 JOIN photos p ON p.id = e.photo_id AND p.deleted_at IS NULL
			 WHERE e.camera_model IS NOT NULL
			 GROUP BY e.camera_model
			 ORDER BY e.camera_model COLLATE NOCASE ASC`,
		)
		.all();

	return { cameras: results ?? [] };
});
