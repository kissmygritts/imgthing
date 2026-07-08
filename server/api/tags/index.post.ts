// Create a tag by name. Names are unique (case-insensitive), so this is
// idempotent: creating a tag that already exists returns the existing row
// rather than erroring.
defineRouteMeta({
	openAPI: {
		tags: ["Tags"],
		summary: "Create tag",
		description:
			"Create a tag by name. Names are unique (case-insensitive), so this is idempotent: creating a tag that already exists returns the existing row rather than erroring.",
		security: [{ sessionCookie: [] }],
		requestBody: {
			required: true,
			content: {
				"application/json": {
					schema: {
						type: "object",
						required: ["name"],
						properties: {
							name: { type: "string", description: "Tag name (trimmed)." },
						},
					},
				},
			},
		},
		responses: {
			"200": {
				description: "The created or existing tag.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								id: { type: "string" },
								name: { type: "string" },
							},
						},
					},
				},
			},
			"400": { description: "`name` is required." },
		},
	},
});

export default defineEventHandler(async (event) => {
	const body = await readBody<{ name?: unknown }>(event);
	const name = typeof body?.name === "string" ? body.name.trim() : "";
	if (!name) {
		throw createError({ statusCode: 400, statusMessage: "Name is required" });
	}

	const db = useDB(event);
	const existing = await db
		.prepare("SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE")
		.bind(name)
		.first<{ id: string; name: string }>();
	if (existing) return existing;

	const id = crypto.randomUUID();
	await db
		.prepare("INSERT INTO tags (id, name) VALUES (?, ?)")
		.bind(id, name)
		.run();
	return { id, name };
});
