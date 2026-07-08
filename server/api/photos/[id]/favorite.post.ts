// Toggle a photo's favorite flag. Flips is_favorite (0 <-> 1) in a single
// statement and returns the new state. 404 if the photo doesn't exist.
defineRouteMeta({
	openAPI: {
		tags: ["Photos"],
		summary: "Favorite photo",
		description:
			"Toggle a photo's favorite flag (flips is_favorite 0 <-> 1) and return the new state. Takes no request body.",
		security: [{ sessionCookie: [] }],
		parameters: [
			{ name: "id", in: "path", required: true, schema: { type: "string" } },
		],
		responses: {
			"200": {
				description: "The new favorite state.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								id: { type: "string" },
								is_favorite: { type: "integer", enum: [0, 1] },
							},
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
			"UPDATE photos SET is_favorite = 1 - is_favorite WHERE id = ? RETURNING is_favorite",
		)
		.bind(id)
		.first<{ is_favorite: number }>();
	if (!row) throw createError({ statusCode: 404, statusMessage: "Not found" });

	return { id, is_favorite: row.is_favorite };
});
