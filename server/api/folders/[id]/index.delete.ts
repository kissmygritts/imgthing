// Delete a folder. Subfolders cascade (ON DELETE CASCADE); folder_photos rows
// cascade too, so photos simply lose this membership — the photos themselves
// and their bytes are untouched.
export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id") as string;
	const db = useDB(event);
	await requireFolder(db, id);

	await db.prepare("DELETE FROM folders WHERE id = ?").bind(id).run();
	return { ok: true };
});
