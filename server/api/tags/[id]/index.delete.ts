// Delete a tag entirely. Its photo_tags junction rows cascade away
// (ON DELETE CASCADE), so every photo simply loses this tag — the photos
// themselves are untouched.
defineRouteMeta({
	openAPI: {
		tags: ["Tags"],
		summary: "Delete tag",
		description:
			"Delete a tag entirely. Its photo_tags junction rows cascade away, so every photo simply loses this tag — the photos themselves are untouched.",
		security: [{ sessionCookie: [] }],
		parameters: [
			{
				name: "id",
				in: "path",
				required: true,
				schema: { type: "string" },
			},
		],
		responses: {
			"200": {
				description: "Tag deleted.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: { ok: { type: "boolean" } },
						},
					},
				},
			},
			"404": { description: "Tag not found." },
		},
	},
});

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id") as string;
	const db = useDB(event);

	const row = await db
		.prepare("SELECT id FROM tags WHERE id = ?")
		.bind(id)
		.first<{ id: string }>();
	if (!row)
		throw createError({ statusCode: 404, statusMessage: "Tag not found" });

	await db.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
	return { ok: true };
});
