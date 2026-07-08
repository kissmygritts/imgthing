// Remove one or more photos from a folder. The photos themselves are untouched.
// Ids ride in the query string (?photoIds=a,b), not a JSON body: in the nitro
// cloudflare_module build the request body is never pumped to the handler for a
// DELETE (the content-length header arrives, but the body stream's end event
// never fires, so readBody() hangs until workerd kills the request). DELETE
// bodies have no defined HTTP semantics (RFC 9110) and are widely dropped, so
// query params are the correct shape for bulk delete anyway.
defineRouteMeta({
	openAPI: {
		tags: ["Folders"],
		summary: "Detach photos from folder",
		description:
			"Remove one or more photos from a folder; the photos themselves are untouched. Ids ride in the query string (`?photoIds=a,b`), never a JSON body (a Workers DELETE-with-body issue).",
		security: [{ sessionCookie: [] }],
		parameters: [
			{
				name: "id",
				in: "path",
				required: true,
				schema: { type: "string" },
			},
			{
				name: "photoIds",
				in: "query",
				required: true,
				description: "Comma-separated photo ids to detach.",
				schema: { type: "string" },
			},
		],
		responses: {
			"200": {
				description: "Photos detached.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								ok: { type: "boolean" },
								removed: { type: "integer" },
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
	const raw = getQuery(event).photoIds;
	const photoIds = (typeof raw === "string" ? raw.split(",") : [])
		.map((p) => p.trim())
		.filter(Boolean);
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
					"DELETE FROM folder_photos WHERE folder_id = ? AND photo_id = ?",
				)
				.bind(id, photoId),
		),
	);

	return { ok: true, removed: photoIds.length };
});
