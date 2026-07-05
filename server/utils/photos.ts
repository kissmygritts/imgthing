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
