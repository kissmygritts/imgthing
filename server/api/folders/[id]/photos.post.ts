// Add one or more photos to a folder. Idempotent: already-present pairs are
// ignored. A photo may live in many folders.
defineRouteMeta({
	openAPI: {
		tags: ["Folders"],
		summary: "Attach photos to folder",
		description:
			"Add one or more photos to a folder. Idempotent: already-present pairs are ignored. A photo may live in many folders.",
		security: [{ sessionCookie: [] }],
		parameters: [
			{
				name: "id",
				in: "path",
				required: true,
				schema: { type: "string" },
			},
		],
		requestBody: {
			required: true,
			content: {
				"application/json": {
					schema: {
						type: "object",
						required: ["photoIds"],
						properties: {
							photoIds: {
								type: "array",
								items: { type: "string" },
								description: "Photo ids to attach.",
							},
						},
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Photos attached.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								ok: { type: "boolean" },
								added: { type: "integer" },
							},
						},
					},
				},
			},
			"400": { description: "`photoIds` is required." },
			"404": { description: "Folder not found." },
		},
	},
});

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id") as string;
	const body = await readBody<{ photoIds?: unknown }>(event);
	const photoIds = Array.isArray(body?.photoIds)
		? body.photoIds.filter((p): p is string => typeof p === "string")
		: [];
	if (photoIds.length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "photoIds is required",
		});
	}

	const db = useDB(event);
	await requireFolder(db, id);

	await db.batch(
		photoIds.map((photoId) =>
			db
				.prepare(
					"INSERT OR IGNORE INTO folder_photos (folder_id, photo_id) VALUES (?, ?)",
				)
				.bind(id, photoId),
		),
	);

	return { ok: true, added: photoIds.length };
});
