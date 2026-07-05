// Geotagged photos for the map view. Returns every photo carrying GPS
// coordinates, joined with the same EXIF summary as GET /api/photos so the
// rows drop straight into the shared PhotoViewer. Kept unpaged: a personal
// library's geotagged subset is small, and the map plots all of it at once.
//
// Response: { photos } — each row is a full photo record with non-null
// gps_latitude / gps_longitude. The thumb variant is derived client-side from
// the id (GET /api/photos/[id]/variant?size=thumb).

export default defineEventHandler(async (event) => {
	const db = useDB(event);

	const { results } = await db
		.prepare(
			`SELECT
				p.id, p.original_filename, p.content_type, p.file_size,
				p.uploaded_at, p.is_favorite,
				e.camera_make, e.camera_model, e.lens_info, e.exposure,
				e.aperture, e.iso, e.focal_length, e.taken_at,
				e.gps_latitude, e.gps_longitude,
				(SELECT GROUP_CONCAT(fp.folder_id)
				 FROM folder_photos fp WHERE fp.photo_id = p.id) AS folder_ids,
				(SELECT GROUP_CONCAT(pt.tag_id)
				 FROM photo_tags pt WHERE pt.photo_id = p.id) AS tag_ids
			 FROM photos p
			 JOIN exif_data e ON e.photo_id = p.id
			 WHERE e.gps_latitude IS NOT NULL AND e.gps_longitude IS NOT NULL
			 ORDER BY p.uploaded_at DESC, p.id DESC`,
		)
		.all();

	return { photos: results ?? [] };
});
