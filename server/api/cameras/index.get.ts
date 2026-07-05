// List the distinct camera models across the library with how many LIVE photos
// each took. Drives the sidebar's Cameras filter group. Tombstoned photos are
// excluded (JOIN ... AND p.deleted_at IS NULL) so counts match the gallery.
export default defineEventHandler(async (event) => {
	const { results } = await useDB(event)
		.prepare(
			`SELECT
				e.camera_model AS name,
				COUNT(*) AS photo_count
			 FROM exif_data e
			 JOIN photos p ON p.id = e.photo_id AND p.deleted_at IS NULL
			 WHERE e.camera_model IS NOT NULL
			 GROUP BY e.camera_model
			 ORDER BY photo_count DESC, e.camera_model COLLATE NOCASE ASC`,
		)
		.all();

	return { cameras: results ?? [] };
});
