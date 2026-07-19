// Unpublish a folder gallery — the revocation primitive. Clears
// public_token/visibility/published_at, so any shared /f/{slug}?token= link
// immediately 404s (the token no longer resolves). Idempotent on an
// already-private folder. Session-gated via server/middleware/auth.ts.
defineRouteMeta({
	openAPI: {
		tags: ["Folders"],
		summary: "Unpublish folder",
		description:
			"Revoke a folder's public gallery — clears its token/visibility so any shared link 404s. Session-gated.",
		security: [{ sessionCookie: [] }],
		parameters: [
			{ name: "id", in: "path", required: true, schema: { type: "string" } },
		],
		responses: {
			"200": {
				description: "Folder unpublished.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: { ok: { type: "boolean" } },
						},
					},
				},
			},
			"404": { description: "Folder not found." },
		},
	},
});

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id") as string;
	const db = useDB(event);
	await requireFolder(db, id);

	await db
		.prepare(
			`UPDATE folders
			 SET visibility = 'private', public_token = NULL, published_at = NULL
			 WHERE id = ?`,
		)
		.bind(id)
		.run();

	return { ok: true };
});
