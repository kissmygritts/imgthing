/**
 * True if re-parenting `folderId` under `newParentId` would create a cycle —
 * i.e. `newParentId` is `folderId` itself or one of its descendants. Walks up
 * the ancestor chain from `newParentId`; if it reaches `folderId`, it's a cycle.
 */
export async function wouldCycle(
	db: D1Database,
	folderId: string,
	newParentId: string,
): Promise<boolean> {
	let current: string | null = newParentId;
	// Bounded by tree depth; guard against malformed data with a hard cap.
	for (let hops = 0; current && hops < 1000; hops++) {
		if (current === folderId) return true;
		const row: { parent_folder_id: string | null } | null = await db
			.prepare("SELECT parent_folder_id FROM folders WHERE id = ?")
			.bind(current)
			.first();
		current = row?.parent_folder_id ?? null;
	}
	return false;
}

/** Fetch a folder row or throw a 404. */
export async function requireFolder(
	db: D1Database,
	id: string,
): Promise<{ id: string; name: string; parent_folder_id: string | null }> {
	const folder = await db
		.prepare("SELECT id, name, parent_folder_id FROM folders WHERE id = ?")
		.bind(id)
		.first<{ id: string; name: string; parent_folder_id: string | null }>();
	if (!folder) {
		throw createError({ statusCode: 404, statusMessage: "Folder not found" });
	}
	return folder;
}
