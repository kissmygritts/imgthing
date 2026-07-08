// List all tags with how many photos carry each. Ordered by name for a stable
// sidebar / autocomplete list.
defineRouteMeta({
	openAPI: {
		tags: ["Tags"],
		summary: "List tags",
		description:
			"List all tags with how many photos carry each, ordered by name for a stable sidebar / autocomplete list.",
		security: [{ sessionCookie: [] }],
		responses: {
			"200": {
				description: "List of tags.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								tags: {
									type: "array",
									items: {
										type: "object",
										properties: {
											id: { type: "string" },
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
				t.id, t.name,
				COUNT(pt.photo_id) AS photo_count
			 FROM tags t
			 LEFT JOIN photo_tags pt ON pt.tag_id = t.id
			 GROUP BY t.id
			 ORDER BY t.name COLLATE NOCASE ASC`,
		)
		.all();

	return { tags: results ?? [] };
});
