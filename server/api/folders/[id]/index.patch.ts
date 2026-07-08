// Rename and/or move a folder. Moving guards against cycles (a folder can't
// become its own descendant). Pass parentFolderId: null to move to the root.
defineRouteMeta({
	openAPI: {
		tags: ["Folders"],
		summary: "Rename or move folder",
		description:
			"Rename and/or move a folder. Moving guards against cycles (a folder can't become its own descendant). Pass `parentFolderId: null` to move to the root.",
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
						properties: {
							name: { type: "string", description: "New folder name." },
							parentFolderId: {
								type: "string",
								nullable: true,
								description: "New parent id, or null for the root.",
							},
						},
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Folder updated.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: { ok: { type: "boolean" } },
						},
					},
				},
			},
			"400": {
				description: "Empty name, a cycle-inducing move, or nothing to update.",
			},
			"404": { description: "Folder or target parent not found." },
		},
	},
});

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id") as string;
	const body = await readBody<{ name?: unknown; parentFolderId?: unknown }>(
		event,
	);
	const db = useDB(event);
	await requireFolder(db, id);

	const sets: string[] = [];
	const binds: (string | null)[] = [];

	if (body && "name" in body) {
		const name = typeof body.name === "string" ? body.name.trim() : "";
		if (!name) {
			throw createError({
				statusCode: 400,
				statusMessage: "Name cannot be empty",
			});
		}
		sets.push("name = ?");
		binds.push(name);
	}

	if (body && "parentFolderId" in body) {
		const parentFolderId =
			typeof body.parentFolderId === "string" && body.parentFolderId
				? body.parentFolderId
				: null;
		if (parentFolderId) {
			await requireFolder(db, parentFolderId);
			if (await wouldCycle(db, id, parentFolderId)) {
				throw createError({
					statusCode: 400,
					statusMessage: "Cannot move a folder into itself or a descendant",
				});
			}
		}
		sets.push("parent_folder_id = ?");
		binds.push(parentFolderId);
	}

	if (sets.length === 0) {
		throw createError({ statusCode: 400, statusMessage: "Nothing to update" });
	}

	sets.push("updated_at = datetime('now')");
	await db
		.prepare(`UPDATE folders SET ${sets.join(", ")} WHERE id = ?`)
		.bind(...binds, id)
		.run();

	return { ok: true };
});
