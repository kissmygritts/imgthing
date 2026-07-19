// Public, unauthenticated variant serving for a published-folder gallery. Lives
// under server/routes/ (not /api) so server/middleware/auth.ts never gates it.
// Reuses the exact per-photo variant objects + self-heal (getOrCreateVariant);
// the folder token just adds a membership gate on top. See ADR 0008.
//
// SECURITY: every failure path returns an identical bare 404 (bad size, bad
// token shape, non-member id, trashed photo, serving error) via publicNotFound()
// — never createError (Nitro would render the 200 SPA HTML shell; see public.ts).
// The membership join is load-bearing: without `p.id = ? AND fp.folder_id = f.id`
// the folder token would be a bearer credential for ANY photo id. No id/r2_key
// ever escapes; variant bytes are WebP re-encodes that strip EXIF/GPS natively.
const TOKEN_RE = /^[0-9a-f]{32}$/;

export default defineEventHandler(async (event) => {
	const size = getRouterParam(event, "size");
	if (!isVariantSize(size)) return publicNotFound();

	const photoId = getRouterParam(event, "photoId");
	if (!photoId) return publicNotFound();

	const token = getQuery(event).token;
	if (typeof token !== "string" || !TOKEN_RE.test(token)) {
		return publicNotFound();
	}

	// Prove the photo is a live, direct member of a folder published under this
	// token before serving a single byte. Any miss (wrong token, non-member id,
	// trashed photo, private folder) collapses to the same uniform 404.
	const row = await useDB(event)
		.prepare(
			`SELECT p.id, p.r2_key
			 FROM photos p
			 JOIN folder_photos fp ON fp.photo_id = p.id
			 JOIN folders f        ON f.id = fp.folder_id
			 WHERE f.public_token = ? AND f.visibility = 'public'
			   AND p.id = ? AND p.deleted_at IS NULL`,
		)
		.bind(token, photoId)
		.first<{ id: string; r2_key: string }>();
	if (!row) return publicNotFound();

	// Any serving failure (e.g. the original object is gone and can't self-heal)
	// collapses to the same uniform 404 — never a 500 HTML page.
	let stream: ReadableStream<Uint8Array>;
	try {
		stream = await getOrCreateVariant(
			useDB(event),
			useImages(event),
			useBucket(event),
			row,
			size,
		);
	} catch {
		return publicNotFound();
	}

	setHeader(event, "content-type", "image/webp");
	// Short public cache — the accepted ≤1h revocation window. Do not raise.
	setHeader(event, "cache-control", "public, max-age=3600");
	setHeader(event, "access-control-allow-origin", "*");
	return stream;
});
