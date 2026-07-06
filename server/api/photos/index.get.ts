// List photos with their EXIF summary. Server-side search, filtering, sorting
// and limit/offset paging.
//
// Query params:
//   q         filename substring match (case-insensitive LIKE)
//   from/to   inclusive date range over COALESCE(taken_at, uploaded_at)
//   dateFrom/dateTo  inclusive date range over EXIF taken_at only (undated
//             photos, taken_at IS NULL, fall out of any bounded range)
//   sort      newest | oldest | name | size_desc | size_asc  (default newest)
//   folderId  a folder id, or "none" for photos in no folder
//   favorite  "1" to return only favorited photos
//   tag       a tag id or (case-insensitive) tag name — only photos carrying it
//   camera    exact EXIF camera_model — only photos shot on it
//   lens      exact EXIF lens_info — only photos shot with it (ANDs with camera)
//   deleted   "1" to return only trashed (tombstoned) photos; default excludes them
//   limit     1..200 (default 50)   offset  >= 0 (default 0)
//
// Response: { photos, total, limit, offset } — `total` is the full match count
// (ignoring limit/offset) so the client can page.

const SORTS = {
	newest: "p.uploaded_at DESC, p.id DESC",
	oldest: "p.uploaded_at ASC, p.id ASC",
	name: "p.original_filename COLLATE NOCASE ASC, p.id ASC",
	size_desc: "p.file_size DESC, p.id DESC",
	size_asc: "p.file_size ASC, p.id ASC",
} as const;

type SortKey = keyof typeof SORTS;

// Escape LIKE wildcards so a literal % or _ in the search text matches itself.
function escapeLike(s: string): string {
	return s.replace(/[\\%_]/g, "\\$&");
}

// Build the shared WHERE clause + binds from the query params. The same set of
// conditions drives both the COUNT and the paged SELECT, so total stays honest.
// Later tasks (favorites, tags) can extend this by pushing more conditions.
function buildFilter(q: Record<string, unknown>) {
	const conditions: string[] = [];
	const binds: (string | number)[] = [];

	// Tombstones are hidden from every normal view. ?deleted=1 flips to the Trash
	// view (only tombstoned rows); otherwise only live (deleted_at IS NULL) rows.
	const deleted = q.deleted === "1" || q.deleted === 1 || q.deleted === true;
	conditions.push(
		deleted ? "p.deleted_at IS NOT NULL" : "p.deleted_at IS NULL",
	);

	const folderId = typeof q.folderId === "string" ? q.folderId : "";
	if (folderId === "none") {
		conditions.push(
			"NOT EXISTS (SELECT 1 FROM folder_photos fp WHERE fp.photo_id = p.id)",
		);
	} else if (folderId) {
		conditions.push(
			"EXISTS (SELECT 1 FROM folder_photos fp WHERE fp.photo_id = p.id AND fp.folder_id = ?)",
		);
		binds.push(folderId);
	}

	const search = typeof q.q === "string" ? q.q.trim() : "";
	if (search) {
		conditions.push("p.original_filename LIKE ? ESCAPE '\\'");
		binds.push(`%${escapeLike(search)}%`);
	}

	const from = typeof q.from === "string" ? q.from.trim() : "";
	if (from) {
		conditions.push("COALESCE(e.taken_at, p.uploaded_at) >= ?");
		binds.push(from);
	}

	const to = typeof q.to === "string" ? q.to.trim() : "";
	if (to) {
		conditions.push("COALESCE(e.taken_at, p.uploaded_at) <= ?");
		binds.push(to);
	}

	// ?dateFrom / ?dateTo filter by EXIF taken_at (when the photo was shot), NOT
	// upload time. taken_at is ISO-ish TEXT so a lexical >= lower bound is
	// chronological; the upper bound uses date(taken_at) <= date(?) so an end date
	// includes that whole day. Photos with taken_at IS NULL yield NULL on both
	// comparisons and fall out of any bounded range — undated photos aren't "in" a
	// date range, which is correct.
	const dateFrom = typeof q.dateFrom === "string" ? q.dateFrom.trim() : "";
	if (dateFrom) {
		conditions.push("e.taken_at >= ?");
		binds.push(dateFrom);
	}

	const dateTo = typeof q.dateTo === "string" ? q.dateTo.trim() : "";
	if (dateTo) {
		conditions.push("date(e.taken_at) <= date(?)");
		binds.push(dateTo);
	}

	if (q.favorite === "1" || q.favorite === 1 || q.favorite === true) {
		conditions.push("p.is_favorite = 1");
	}

	// ?tag accepts either a tag id or a tag name (case-insensitive), so the
	// sidebar can filter by id while a URL/search can filter by a human name.
	const tag = typeof q.tag === "string" ? q.tag.trim() : "";
	if (tag) {
		conditions.push(
			`EXISTS (SELECT 1 FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id
			         WHERE pt.photo_id = p.id AND (t.id = ? OR t.name = ? COLLATE NOCASE))`,
		);
		binds.push(tag, tag);
	}

	// ?camera and ?lens filter by exact EXIF value (the sidebar sends the model /
	// lens string aggregated by /api/cameras and /api/lenses). Both may be present
	// at once — they AND together, so the gallery shows a camera+lens combination.
	const camera = typeof q.camera === "string" ? q.camera.trim() : "";
	if (camera) {
		conditions.push("e.camera_model = ?");
		binds.push(camera);
	}

	const lens = typeof q.lens === "string" ? q.lens.trim() : "";
	if (lens) {
		conditions.push("e.lens_info = ?");
		binds.push(lens);
	}

	const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
	return { where, binds };
}

export default defineEventHandler(async (event) => {
	const q = getQuery(event);
	const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
	const offset = Math.max(Number(q.offset) || 0, 0);
	const sort: SortKey =
		typeof q.sort === "string" && q.sort in SORTS
			? (q.sort as SortKey)
			: "newest";

	const { where, binds } = buildFilter(q);
	const db = useDB(event);

	const countRow = await db
		.prepare(
			`SELECT COUNT(*) AS total
			 FROM photos p
			 LEFT JOIN exif_data e ON e.photo_id = p.id
			 ${where}`,
		)
		.bind(...binds)
		.first<{ total: number }>();

	const { results } = await db
		.prepare(
			`SELECT
				p.id, p.original_filename, p.content_type, p.file_size,
				p.uploaded_at, p.is_favorite,
				p.visibility, p.public_token, p.show_location,
				e.camera_make, e.camera_model, e.lens_info, e.exposure,
				e.aperture, e.iso, e.focal_length, e.taken_at,
				e.gps_latitude, e.gps_longitude,
				(SELECT GROUP_CONCAT(fp.folder_id)
				 FROM folder_photos fp WHERE fp.photo_id = p.id) AS folder_ids,
				(SELECT GROUP_CONCAT(pt.tag_id)
				 FROM photo_tags pt WHERE pt.photo_id = p.id) AS tag_ids
			 FROM photos p
			 LEFT JOIN exif_data e ON e.photo_id = p.id
			 ${where}
			 ORDER BY ${SORTS[sort]}
			 LIMIT ? OFFSET ?`,
		)
		.bind(...binds, limit, offset)
		.all();

	return {
		photos: results ?? [],
		total: countRow?.total ?? 0,
		limit,
		offset,
	};
});
