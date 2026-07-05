// Revoke a photo's public share: clear visibility/token/published_at. Idempotent
// on an already-private photo; 404 only if the row doesn't exist at all. No purge
// step — dropping the token is the whole revocation (variants stay in R2 for the
// private serving path). Session-gated via server/middleware/auth.ts.
export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id");
	if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

	const db = useDB(event);
	await requirePhoto(db, id);

	await db
		.prepare(
			"UPDATE photos SET visibility = 'private', public_token = NULL, published_at = NULL WHERE id = ?",
		)
		.bind(id)
		.run();

	return { ok: true };
});
