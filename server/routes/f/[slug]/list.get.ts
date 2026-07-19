// Public, unauthenticated folder-gallery manifest by share token. Lives under
// server/routes/ (not /api) so server/middleware/auth.ts never gates it; the
// {slug} path segment is cosmetic — resolution is by token only. See ADR 0008.
//
// SECURITY: every failure path returns an identical bare 404 (bad token shape,
// no folder, not public) via publicNotFound() — never createError, which Nitro
// would render as the 200 SPA/error HTML shell (a revoked token would look alive
// and leak app HTML). The manifest is whitelisted — { folderName, photos:[{ id,
// filename }] } — and NEVER emits r2_key or any EXIF/GPS. Exposing member photo
// ids is safe: the byte route re-proves folder membership on every request.
const TOKEN_RE = /^[0-9a-f]{32}$/;

export default defineEventHandler(async (event) => {
	const token = getQuery(event).token;
	// Cheap shape guard before touching D1.
	if (typeof token !== "string" || !TOKEN_RE.test(token)) {
		return publicNotFound();
	}

	const db = useDB(event);

	// The single token-resolution point. A non-public / unknown token → 404. This
	// is separate from the member query so an *empty* published folder still
	// renders a 200 empty-state gallery (distinct from a 404 "no such gallery").
	const folder = await db
		.prepare(
			"SELECT name FROM folders WHERE public_token = ? AND visibility = 'public'",
		)
		.bind(token)
		.first<{ name: string }>();
	if (!folder) return publicNotFound();

	// Direct members only (no nesting), trashed excluded. Ordered by capture time
	// (taken_at) with an uploaded_at fallback so gallery order matches the library.
	const { results } = await db
		.prepare(
			`SELECT p.id, p.original_filename AS filename
			 FROM photos p
			 JOIN folder_photos fp ON fp.photo_id = p.id
			 JOIN folders f        ON f.id = fp.folder_id
			 LEFT JOIN exif_data ed ON ed.photo_id = p.id
			 WHERE f.public_token = ? AND f.visibility = 'public'
			   AND p.deleted_at IS NULL
			 ORDER BY COALESCE(ed.taken_at, p.uploaded_at) DESC`,
		)
		.bind(token)
		.all<{ id: string; filename: string }>();

	return { folderName: folder.name, photos: results ?? [] };
});
