// List the distinct lenses across the library with how many LIVE photos each
// shot. Mirrors /api/cameras — drives the sidebar's Lenses filter group.
// Tombstoned photos are excluded so counts match the gallery.
export default defineEventHandler(async (event) => {
	const { results } = await useDB(event)
		.prepare(
			`SELECT
				e.lens_info AS name,
				COUNT(*) AS photo_count
			 FROM exif_data e
			 JOIN photos p ON p.id = e.photo_id AND p.deleted_at IS NULL
			 WHERE e.lens_info IS NOT NULL
			 GROUP BY e.lens_info
			 ORDER BY photo_count DESC, e.lens_info COLLATE NOCASE ASC`,
		)
		.all();

	return { lenses: results ?? [] };
});
