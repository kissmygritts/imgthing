// Public, unauthenticated EXIF metadata for a shared photo. Lives under
// server/routes/ (not /api) so server/middleware/auth.ts never gates it.
//
// SECURITY: same uniform-404 discipline as the variant route — bad token shape
// or no matching row both return a bare 404. GPS is opt-in: coordinates appear
// ONLY when the owner set show_location AND the photo actually has coordinates.
// Never select or return id/r2_key or other_data (the raw EXIF blob can itself
// carry GPS/serials) — only the whitelisted display fields below.
const TOKEN_RE = /^[0-9a-f]{32}$/;

interface MetaRow {
	original_filename: string;
	published_at: string | null;
	show_location: number;
	camera_make: string | null;
	camera_model: string | null;
	lens_info: string | null;
	exposure: string | null;
	aperture: string | null;
	iso: number | null;
	focal_length: string | null;
	taken_at: string | null;
	gps_latitude: number | null;
	gps_longitude: number | null;
}

export default defineEventHandler(async (event) => {
	const token = getRouterParam(event, "token") ?? "";
	if (!TOKEN_RE.test(token)) throw createError({ statusCode: 404 });

	const row = await useDB(event)
		.prepare(
			`SELECT p.original_filename, p.published_at, p.show_location,
			        e.camera_make, e.camera_model, e.lens_info, e.exposure, e.aperture,
			        e.iso, e.focal_length, e.taken_at, e.gps_latitude, e.gps_longitude
			 FROM photos p
			 LEFT JOIN exif_data e ON e.photo_id = p.id
			 WHERE p.public_token = ? AND p.visibility = 'public' AND p.deleted_at IS NULL`,
		)
		.bind(token)
		.first<MetaRow>();
	if (!row) throw createError({ statusCode: 404 });

	const gps =
		row.show_location === 1 &&
		row.gps_latitude != null &&
		row.gps_longitude != null
			? { latitude: row.gps_latitude, longitude: row.gps_longitude }
			: null;

	setHeader(event, "access-control-allow-origin", "*");
	setHeader(event, "cache-control", "public, max-age=300");
	return {
		filename: row.original_filename,
		takenAt: row.taken_at,
		camera: { make: row.camera_make, model: row.camera_model },
		lens: row.lens_info,
		exposure: row.exposure,
		aperture: row.aperture,
		iso: row.iso,
		focalLength: row.focal_length,
		publishedAt: row.published_at,
		gps,
	};
});
