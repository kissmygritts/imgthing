// Publish a photo for tokened public sharing. Mints a FRESH token every call —
// rotation is the revocation primitive, so re-publishing invalidates any prior
// URL. Returns the token plus fully-qualified public URLs built from the request
// origin. Session-gated via server/middleware/auth.ts.
defineRouteMeta({
	openAPI: {
		tags: ["Photos"],
		summary: "Publish photo",
		description:
			"Publish a photo for tokened public sharing. Mints a fresh token every call (rotation revokes any prior URL) and returns the token plus fully-qualified public URLs. Session-gated.",
		security: [{ sessionCookie: [] }],
		parameters: [
			{ name: "id", in: "path", required: true, schema: { type: "string" } },
		],
		requestBody: {
			description: "Optional flag controlling whether GPS location is exposed.",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: { showLocation: { type: "boolean" } },
					},
				},
			},
		},
		responses: {
			"200": {
				description: "The public token plus fully-qualified share URLs.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								token: { type: "string" },
								urls: {
									type: "object",
									properties: {
										thumb: { type: "string" },
										md: { type: "string" },
										lg: { type: "string" },
										meta: { type: "string" },
									},
								},
							},
						},
					},
				},
			},
			"400": { description: "Missing id." },
			"404": { description: "Photo is missing or in Trash." },
		},
	},
});

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id");
	if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

	const body = await readBody<{ showLocation?: boolean }>(event).catch(
		() => ({}) as { showLocation?: boolean },
	);
	const showLocation = body?.showLocation === true;

	const token = generatePublicToken();
	const db = useDB(event);

	// Update only a live (non-trashed) photo; a zero-row result means the photo is
	// missing or in Trash — a uniform 404 either way (don't distinguish).
	const res = await db
		.prepare(
			`UPDATE photos
			 SET visibility = 'public', public_token = ?, published_at = datetime('now'), show_location = ?
			 WHERE id = ? AND deleted_at IS NULL`,
		)
		.bind(token, showLocation ? 1 : 0, id)
		.run();
	if (!res.meta.changes) {
		throw createError({ statusCode: 404, statusMessage: "Not found" });
	}

	const origin = getRequestURL(event).origin;
	return {
		token,
		urls: {
			thumb: `${origin}/p/${token}/thumb`,
			md: `${origin}/p/${token}/md`,
			lg: `${origin}/p/${token}/lg`,
			meta: `${origin}/p/${token}/meta`,
		},
	};
});
