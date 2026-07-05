// List photos (newest first) with their EXIF summary. Simple limit/offset paging.
export default defineEventHandler(async (event) => {
	const q = getQuery(event);
	const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
	const offset = Math.max(Number(q.offset) || 0, 0);

	const { results } = await useDB(event)
		.prepare(
			`SELECT
				p.id, p.original_filename, p.content_type, p.file_size,
				p.folder_id, p.uploaded_at,
				e.camera_make, e.camera_model, e.lens_info, e.exposure,
				e.aperture, e.iso, e.focal_length, e.taken_at,
				e.gps_latitude, e.gps_longitude
			 FROM photos p
			 LEFT JOIN exif_data e ON e.photo_id = p.id
			 ORDER BY p.uploaded_at DESC, p.id DESC
			 LIMIT ? OFFSET ?`,
		)
		.bind(limit, offset)
		.all();

	return { photos: results ?? [], limit, offset };
});
