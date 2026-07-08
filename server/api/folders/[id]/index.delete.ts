// Delete a folder. Subfolders cascade (ON DELETE CASCADE); folder_photos rows
// cascade too, so photos simply lose this membership — the photos themselves
// and their bytes are untouched.
defineRouteMeta({
	openAPI: {
		tags: ["Folders"],
		summary: "Delete folder",
		description:
			"Delete a folder. Subfolders and folder_photos rows cascade away, so photos lose this membership only — the photos and their bytes are untouched.",
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
				description: "Folder deleted.",
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

	await db.prepare("DELETE FROM folders WHERE id = ?").bind(id).run();
	return { ok: true };
});
