// Public, unauthenticated variant serving by share token. Lives under
// server/routes/ (not /api) so server/middleware/auth.ts never gates it.
//
// SECURITY: every failure path returns an identical bare 404 — bad size, bad
// token shape, no matching row, private, or trashed all look the same. Never
// leak whether a token exists or why serving failed. No id/r2_key ever escapes.
const TOKEN_RE = /^[0-9a-f]{32}$/;

export default defineEventHandler(async (event) => {
	const size = getRouterParam(event, "size");
	if (!isVariantSize(size)) throw createError({ statusCode: 404 });

	const token = getRouterParam(event, "token") ?? "";
	// Cheap shape guard before touching D1.
	if (!TOKEN_RE.test(token)) throw createError({ statusCode: 404 });

	const row = await useDB(event)
		.prepare(
			"SELECT id, r2_key FROM photos WHERE public_token = ? AND visibility = 'public' AND deleted_at IS NULL",
		)
		.bind(token)
		.first<{ id: string; r2_key: string }>();
	if (!row) throw createError({ statusCode: 404 });

	const stream = await getOrCreateVariant(
		useDB(event),
		useImages(event),
		useBucket(event),
		row,
		size,
	);

	setHeader(event, "content-type", "image/webp");
	// Short public cache — the accepted ≤1h revocation window. Do not raise.
	setHeader(event, "cache-control", "public, max-age=3600");
	setHeader(event, "access-control-allow-origin", "*");
	return stream;
});
