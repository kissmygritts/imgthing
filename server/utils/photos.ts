/**
 * Mint a fresh public-share token: 16 random bytes (128 bits) hex-encoded to a
 * 32-char string. Rotation is the revocation primitive — every publish mints a
 * new token, so an old URL stops resolving the moment a photo is re-published.
 */
export function generatePublicToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Assert a photo row exists or throw a 404. */
export async function requirePhoto(
	db: D1Database,
	id: string,
): Promise<{ id: string }> {
	const photo = await db
		.prepare("SELECT id FROM photos WHERE id = ?")
		.bind(id)
		.first<{ id: string }>();
	if (!photo) {
		throw createError({ statusCode: 404, statusMessage: "Photo not found" });
	}
	return photo;
}

/**
 * Permanently remove one or more photos: drop each R2 object first, then batch a
 * full D1 cleanup (exif_data, folder_photos, photo_tags, and the photos row) for
 * every id. Resilient to already-missing R2 bytes — a failed delete() still lets
 * the D1 cleanup proceed. Shared by permanent-delete (`?purge=1`) and empty-trash.
 */
export async function purgePhotos(
	db: D1Database,
	bucket: R2Bucket,
	rows: { id: string; r2_key: string }[],
): Promise<void> {
	if (rows.length === 0) return;

	// R2 first. delete() is idempotent (no error if the key is already gone), but
	// guard each one so a transient R2 error still lets the D1 cleanup proceed.
	await Promise.all(rows.map((r) => bucket.delete(r.r2_key).catch(() => {})));

	const statements = rows.flatMap((r) => [
		db.prepare("DELETE FROM exif_data WHERE photo_id = ?").bind(r.id),
		db.prepare("DELETE FROM folder_photos WHERE photo_id = ?").bind(r.id),
		db.prepare("DELETE FROM photo_tags WHERE photo_id = ?").bind(r.id),
		db.prepare("DELETE FROM photos WHERE id = ?").bind(r.id),
	]);
	await db.batch(statements);
}
