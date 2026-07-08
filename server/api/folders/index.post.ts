// Create a folder, optionally nested under an existing parent.
defineRouteMeta({
	openAPI: {
		tags: ["Folders"],
		summary: "Create folder",
		description: "Create a folder, optionally nested under an existing parent.",
		security: [{ sessionCookie: [] }],
		requestBody: {
			required: true,
			content: {
				"application/json": {
					schema: {
						type: "object",
						required: ["name"],
						properties: {
							name: { type: "string", description: "Folder name (trimmed)." },
							parentFolderId: {
								type: "string",
								nullable: true,
								description: "Parent folder id, or null/omitted for the root.",
							},
						},
					},
				},
			},
		},
		responses: {
			"200": {
				description: "The created folder.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								id: { type: "string" },
								name: { type: "string" },
								parent_folder_id: { type: "string", nullable: true },
							},
						},
					},
				},
			},
			"400": { description: "`name` is required." },
			"404": { description: "`parentFolderId` does not exist." },
		},
	},
});

export default defineEventHandler(async (event) => {
	const body = await readBody<{ name?: unknown; parentFolderId?: unknown }>(
		event,
	);
	const name = typeof body?.name === "string" ? body.name.trim() : "";
	if (!name) {
		throw createError({ statusCode: 400, statusMessage: "Name is required" });
	}
	const parentFolderId =
		typeof body?.parentFolderId === "string" && body.parentFolderId
			? body.parentFolderId
			: null;

	const db = useDB(event);
	if (parentFolderId) {
		await requireFolder(db, parentFolderId);
	}

	const id = crypto.randomUUID();
	await db
		.prepare(
			"INSERT INTO folders (id, name, parent_folder_id) VALUES (?, ?, ?)",
		)
		.bind(id, name, parentFolderId)
		.run();

	return { id, name, parent_folder_id: parentFolderId };
});
