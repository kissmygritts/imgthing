// List all folders (flat) with their direct photo counts. The client assembles
// the tree from parent_folder_id. Ordered by name for a stable sidebar.
export default defineEventHandler(async (event) => {
	const { results } = await useDB(event)
		.prepare(
			`SELECT
				f.id, f.name, f.parent_folder_id, f.created_at, f.updated_at,
				COUNT(fp.photo_id) AS photo_count
			 FROM folders f
			 LEFT JOIN folder_photos fp ON fp.folder_id = f.id
			 GROUP BY f.id
			 ORDER BY f.name COLLATE NOCASE ASC`,
		)
		.all();

	return { folders: results ?? [] };
});
