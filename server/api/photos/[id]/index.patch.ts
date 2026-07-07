// Edit a photo's user-facing metadata. Accepts a JSON patch of the editable
// fields only — the EXIF text fields (camera_make, camera_model, lens_info,
// exposure, aperture, focal_length), the numeric `iso`, the GPS coordinates
// (gps_latitude/gps_longitude — set or cleared together from the map picker), and
// `original_filename` (rename). Everything else in the body is ignored
// (forward-compatible with the client sending a wider Partial<Photo>): `taken_at`
// stays display-only.
//
// EXIF columns UPSERT into exif_data (a photo may have no row yet); the filename
// lives on the photos row. Any successful edit bumps photos.updated_at. 404 if the
// photo is missing or soft-deleted. Returns the updated photo in the list shape.
// Session-gated via server/middleware/auth.ts.

// The editable EXIF text columns (values map straight to exif_data columns).
const EXIF_TEXT_KEYS = [
	"camera_make",
	"camera_model",
	"lens_info",
	"exposure",
	"aperture",
	"focal_length",
] as const;

// Normalize a text value: null/blank collapse to NULL so clearing a field works.
function coerceText(raw: unknown): string | null {
	if (raw == null) return null;
	const s = String(raw).trim();
	return s === "" ? null : s;
}

// iso is an INTEGER column: blank/invalid → NULL, otherwise a truncated integer.
function coerceIso(raw: unknown): number | null {
	if (raw == null) return null;
	if (typeof raw === "number")
		return Number.isFinite(raw) ? Math.trunc(raw) : null;
	const s = String(raw).trim();
	if (s === "") return null;
	const n = Number(s);
	return Number.isFinite(n) ? Math.trunc(n) : null;
}

// GPS columns are REAL: blank/invalid → NULL (clears the location), otherwise the
// number, but only if it's in range (latitude ±90, longitude ±180) so a bad value
// can't drop the photo at a bogus point on the map.
function coerceGps(raw: unknown, kind: "lat" | "lng"): number | null {
	if (raw == null) return null;
	const n = typeof raw === "number" ? raw : Number(String(raw).trim());
	if (!Number.isFinite(n)) return null;
	return Math.abs(n) <= (kind === "lat" ? 90 : 180) ? n : null;
}

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id");
	if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

	const body = await readBody<Record<string, unknown>>(event).catch(
		() => ({}) as Record<string, unknown>,
	);

	const db = useDB(event);

	// 404 a missing or soft-deleted photo before touching anything.
	const live = await db
		.prepare("SELECT id FROM photos WHERE id = ? AND deleted_at IS NULL")
		.bind(id)
		.first<{ id: string }>();
	if (!live) throw createError({ statusCode: 404, statusMessage: "Not found" });

	// Collect the EXIF columns present in the patch (unknown keys are ignored).
	const exifCols: string[] = [];
	const exifVals: (string | number | null)[] = [];
	for (const key of EXIF_TEXT_KEYS) {
		if (Object.hasOwn(body, key)) {
			exifCols.push(key);
			exifVals.push(coerceText(body[key]));
		}
	}
	if (Object.hasOwn(body, "iso")) {
		exifCols.push("iso");
		exifVals.push(coerceIso(body.iso));
	}
	if (Object.hasOwn(body, "gps_latitude")) {
		exifCols.push("gps_latitude");
		exifVals.push(coerceGps(body.gps_latitude, "lat"));
	}
	if (Object.hasOwn(body, "gps_longitude")) {
		exifCols.push("gps_longitude");
		exifVals.push(coerceGps(body.gps_longitude, "lng"));
	}

	const statements = [];

	// UPSERT the EXIF row: insert only the patched columns (rest default NULL), or
	// update just those columns on an existing row (keyed by the unique photo_id).
	if (exifCols.length > 0) {
		const placeholders = exifCols.map(() => "?").join(", ");
		const updates = exifCols.map((c) => `${c} = excluded.${c}`).join(", ");
		statements.push(
			db
				.prepare(
					`INSERT INTO exif_data (id, photo_id, ${exifCols.join(", ")})
					 VALUES (?, ?, ${placeholders})
					 ON CONFLICT(photo_id) DO UPDATE SET ${updates}`,
				)
				.bind(crypto.randomUUID(), id, ...exifVals),
		);
	}

	// Rename: only apply a non-blank filename (the column is NOT NULL). Always bump
	// updated_at so an edit is reflected even when only EXIF changed.
	const newName = Object.hasOwn(body, "original_filename")
		? coerceText(body.original_filename)
		: undefined;
	if (newName != null) {
		statements.push(
			db
				.prepare(
					"UPDATE photos SET original_filename = ?, updated_at = datetime('now') WHERE id = ?",
				)
				.bind(newName, id),
		);
	} else {
		statements.push(
			db
				.prepare("UPDATE photos SET updated_at = datetime('now') WHERE id = ?")
				.bind(id),
		);
	}

	await db.batch(statements);

	// Return the updated photo in the same shape GET /api/photos serves.
	const photo = await db
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
			 WHERE p.id = ?`,
		)
		.bind(id)
		.first();

	return { photo };
});
