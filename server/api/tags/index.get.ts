// List all tags with how many photos carry each. Ordered by name for a stable
// sidebar / autocomplete list.
export default defineEventHandler(async (event) => {
	const { results } = await useDB(event)
		.prepare(
			`SELECT
				t.id, t.name,
				COUNT(pt.photo_id) AS photo_count
			 FROM tags t
			 LEFT JOIN photo_tags pt ON pt.tag_id = t.id
			 GROUP BY t.id
			 ORDER BY t.name COLLATE NOCASE ASC`,
		)
		.all();

	return { tags: results ?? [] };
});
