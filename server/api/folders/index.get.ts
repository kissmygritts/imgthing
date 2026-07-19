// List all folders (flat) with their direct photo counts. The client assembles
// the tree from parent_folder_id. Ordered by name for a stable sidebar.
defineRouteMeta({
	openAPI: {
		tags: ["Folders"],
		summary: "List folders",
		description:
			"List all folders (flat) with their direct photo counts, ordered by name. The client assembles the tree from `parent_folder_id`.",
		security: [{ sessionCookie: [] }],
		responses: {
			"200": {
				description: "Flat list of folders.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								folders: {
									type: "array",
									items: {
										type: "object",
										properties: {
											id: { type: "string" },
											name: { type: "string" },
											parent_folder_id: {
												type: "string",
												nullable: true,
											},
											created_at: { type: "string" },
											updated_at: { type: "string" },
											photo_count: { type: "integer" },
											visibility: { type: "string" },
											public_token: {
												type: "string",
												nullable: true,
											},
											published_at: {
												type: "string",
												nullable: true,
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
	},
});

export default defineEventHandler(async (event) => {
	const { results } = await useDB(event)
		.prepare(
			`SELECT
				f.id, f.name, f.parent_folder_id, f.created_at, f.updated_at,
				f.visibility, f.public_token, f.published_at,
				COUNT(fp.photo_id) AS photo_count
			 FROM folders f
			 LEFT JOIN folder_photos fp ON fp.folder_id = f.id
			 GROUP BY f.id
			 ORDER BY f.name COLLATE NOCASE ASC`,
		)
		.all();

	return { folders: results ?? [] };
});
