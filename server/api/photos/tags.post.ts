// Batch-attach tags: attach the same tag(s) to many photos at once. Mirrors
// photos/[id]/tags.post.ts but fans the pairs across every given photo id.
// Idempotent — already-present pairs are ignored, and INSERT OR IGNORE also
// drops any pair whose photo id no longer exists. Accepts either/both shapes:
//   ids       photo ids to tag (required)
//   tagIds    existing tag ids to attach
//   names     tag names — reused case-insensitively if present, else created
// Ids ride in the JSON body (POST).
//
// Response: { ok: true, attached: <pair-count>, tagIds: [...] }.
defineRouteMeta({
	openAPI: {
		tags: ["Photos"],
		summary: "Batch tag photos",
		description:
			"Attach the same tag(s) to many photos at once. Idempotent — already-present pairs are ignored, and any pair whose photo id no longer exists is dropped. Accepts existing `tagIds` and/or `names` (reused case-insensitively if present, else created).",
		security: [{ sessionCookie: [] }],
		requestBody: {
			required: true,
			content: {
				"application/json": {
					schema: {
						type: "object",
						required: ["ids"],
						properties: {
							ids: {
								type: "array",
								items: { type: "string" },
								description: "Photo ids to tag.",
							},
							tagIds: {
								type: "array",
								items: { type: "string" },
								description: "Existing tag ids to attach.",
							},
							names: {
								type: "array",
								items: { type: "string" },
								description:
									"Tag names — reused case-insensitively if present, else created.",
							},
						},
					},
				},
			},
		},
		responses: {
			"200": {
				description:
					"The count of (tag, photo) pairs attached and the resolved tag ids.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								ok: { type: "boolean" },
								attached: { type: "integer" },
								tagIds: { type: "array", items: { type: "string" } },
							},
						},
					},
				},
			},
			"400": {
				description:
					"`ids` is required, or neither `tagIds` nor `names` was supplied.",
			},
		},
	},
});

export default defineEventHandler(async (event) => {
	const body = await readBody<{
		ids?: unknown;
		tagIds?: unknown;
		names?: unknown;
	}>(event);

	const ids = Array.isArray(body?.ids)
		? body.ids.filter((s): s is string => typeof s === "string")
		: [];
	const tagIds = Array.isArray(body?.tagIds)
		? body.tagIds.filter((t): t is string => typeof t === "string")
		: [];
	const names = Array.isArray(body?.names)
		? body.names
				.map((n) => (typeof n === "string" ? n.trim() : ""))
				.filter(Boolean)
		: [];

	if (ids.length === 0) {
		throw createError({ statusCode: 400, statusMessage: "ids is required" });
	}
	if (tagIds.length === 0 && names.length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "tagIds or names is required",
		});
	}

	const db = useDB(event);

	// Resolve names → ids, creating any tag that doesn't exist yet (mirrors the
	// single-photo path's "type a new tag" UX).
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

	// Fan every (tag, photo) pair into one batch. OR IGNORE skips duplicates and
	// any pair whose photo id doesn't exist (FK), so the op stays idempotent.
	const pairs = resolved.flatMap((tagId) =>
		ids.map((photoId) =>
			db
				.prepare(
					"INSERT OR IGNORE INTO photo_tags (tag_id, photo_id) VALUES (?, ?)",
				)
				.bind(tagId, photoId),
		),
	);
	await db.batch(pairs);

	return { ok: true, attached: pairs.length, tagIds: resolved };
});
