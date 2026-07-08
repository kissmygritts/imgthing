// Attach tags to a photo. Idempotent: already-present pairs are ignored.
// Accepts two shapes (either or both):
//   tagIds  existing tag ids to attach
//   names   tag names — reused if they already exist (case-insensitive),
//           otherwise created on the fly (the natural "type a new tag" UX)
defineRouteMeta({
	openAPI: {
		tags: ["Photos"],
		summary: "Attach tags to photo",
		description:
			"Attach tags to a photo (idempotent). Accepts `tagIds` (existing tag ids) and/or `names` (reused case-insensitively if they exist, else created on the fly). Session-gated.",
		security: [{ sessionCookie: [] }],
		parameters: [
			{ name: "id", in: "path", required: true, schema: { type: "string" } },
		],
		requestBody: {
			required: true,
			description: "At least one of `tagIds` or `names` must be non-empty.",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							tagIds: { type: "array", items: { type: "string" } },
							names: { type: "array", items: { type: "string" } },
						},
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Tags attached; `attached` is the count resolved.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								ok: { type: "boolean" },
								attached: { type: "integer" },
							},
						},
					},
				},
			},
			"400": { description: "`tagIds` or `names` is required." },
			"404": { description: "Photo not found." },
		},
	},
});

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id") as string;
	const body = await readBody<{ tagIds?: unknown; names?: unknown }>(event);

	const tagIds = Array.isArray(body?.tagIds)
		? body.tagIds.filter((t): t is string => typeof t === "string")
		: [];
	const names = Array.isArray(body?.names)
		? body.names
				.map((n) => (typeof n === "string" ? n.trim() : ""))
				.filter(Boolean)
		: [];

	if (tagIds.length === 0 && names.length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "tagIds or names is required",
		});
	}

	const db = useDB(event);
	await requirePhoto(db, id);

	// Resolve names → ids, creating any tag that doesn't exist yet.
	const resolved = [...tagIds];
	for (const name of names) {
		const existing = await db
			.prepare("SELECT id FROM tags WHERE name = ? COLLATE NOCASE")
			.bind(name)
			.first<{ id: string }>();
		if (existing) {
			resolved.push(existing.id);
		} else {
			const newId = crypto.randomUUID();
			await db
				.prepare("INSERT INTO tags (id, name) VALUES (?, ?)")
				.bind(newId, name)
				.run();
			resolved.push(newId);
		}
	}

	await db.batch(
		resolved.map((tagId) =>
			db
				.prepare(
					"INSERT OR IGNORE INTO photo_tags (tag_id, photo_id) VALUES (?, ?)",
				)
				.bind(tagId, id),
		),
	);

	return { ok: true, attached: resolved.length };
});
