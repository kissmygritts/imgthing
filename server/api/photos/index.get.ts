// List photos (newest first) with their EXIF summary. Simple limit/offset paging.
// Optional ?folderId filters to a folder's members; ?folderId=none lists photos
// that belong to no folder ("uncategorized").
export default defineEventHandler(async (event) => {
	const q = getQuery(event);
	const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
	const offset = Math.max(Number(q.offset) || 0, 0);
	const folderId = typeof q.folderId === "string" ? q.folderId : "";

	let where = "";
	const binds: (string | number)[] = [];
	if (folderId === "none") {
		where =
			"WHERE NOT EXISTS (SELECT 1 FROM folder_photos fp WHERE fp.photo_id = p.id)";
	} else if (folderId) {
		where =
			"WHERE EXISTS (SELECT 1 FROM folder_photos fp WHERE fp.photo_id = p.id AND fp.folder_id = ?)";
		binds.push(folderId);
	}
	binds.push(limit, offset);

	const { results } = await useDB(event)
		.prepare(
			`SELECT
				p.id, p.original_filename, p.content_type, p.file_size,
				p.uploaded_at,
				e.camera_make, e.camera_model, e.lens_info, e.exposure,
				e.aperture, e.iso, e.focal_length, e.taken_at,
				e.gps_latitude, e.gps_longitude,
				(SELECT GROUP_CONCAT(fp.folder_id)
				 FROM folder_photos fp WHERE fp.photo_id = p.id) AS folder_ids
			 FROM photos p
			 LEFT JOIN exif_data e ON e.photo_id = p.id
			 ${where}
			 ORDER BY p.uploaded_at DESC, p.id DESC
			 LIMIT ? OFFSET ?`,
		)
		.bind(...binds)
		.all();

	return { photos: results ?? [], limit, offset };
});
