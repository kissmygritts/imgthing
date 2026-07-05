// Create a folder, optionally nested under an existing parent.
export default defineEventHandler(async (event) => {
	const body = await readBody<{ name?: unknown; parentFolderId?: unknown }>(
		event,
	);
	const name = typeof body?.name === "string" ? body.name.trim() : "";
	if (!name) {
		throw createError({ statusCode: 400, statusMessage: "Name is required" });
	}
	const parentFolderId =
		typeof body?.parentFolderId === "string" && body.parentFolderId
			? body.parentFolderId
			: null;

	const db = useDB(event);
	if (parentFolderId) {
		await requireFolder(db, parentFolderId);
	}

	const id = crypto.randomUUID();
	await db
		.prepare(
			"INSERT INTO folders (id, name, parent_folder_id) VALUES (?, ?, ?)",
		)
		.bind(id, name, parentFolderId)
		.run();

	return { id, name, parent_folder_id: parentFolderId };
});
