// Restore a tombstoned photo: clear deleted_at so it returns to the live library.
// Idempotent on an already-live photo; 404 if the row doesn't exist at all.
defineRouteMeta({
	openAPI: {
		tags: ["Photos"],
		summary: "Restore photo",
		description:
			"Restore a tombstoned photo: clear deleted_at so it returns to the live library. Idempotent on an already-live photo; 404 if the row doesn't exist. Takes no request body. Session-gated.",
		security: [{ sessionCookie: [] }],
		parameters: [
			{ name: "id", in: "path", required: true, schema: { type: "string" } },
		],
		responses: {
			"200": {
				description: "Photo restored.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: { ok: { type: "boolean" } },
						},
					},
				},
			},
			"404": { description: "Photo not found." },
		},
	},
});

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id");
	if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

	const db = useDB(event);
	await requirePhoto(db, id);

	await db
		.prepare("UPDATE photos SET deleted_at = NULL WHERE id = ?")
		.bind(id)
		.run();

	return { ok: true };
});
