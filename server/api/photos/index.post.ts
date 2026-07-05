// Upload one or more images: original bytes stream to R2, metadata + EXIF to D1.
// An optional `folderId` text field assigns every uploaded photo to that folder.
export default defineEventHandler(async (event) => {
	const parts = await readMultipartFormData(event);
	const files = (parts ?? []).filter(
		(p) => p.filename && p.data && (p.type ?? "").startsWith("image/"),
	);

	// Optional target folder: a non-file text part carrying an existing folder id.
	const folderPart = (parts ?? []).find(
		(p) => p.name === "folderId" && !p.filename,
	);
	const folderId = folderPart?.data
		? new TextDecoder().decode(folderPart.data).trim()
		: "";

	if (files.length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "No image files in upload",
		});
	}

	const db = useDB(event);
	const bucket = useBucket(event);

	// Validate the target folder up front so we never upload bytes to R2 only to
	// discover the folder doesn't exist (requireFolder throws a 404).
	if (folderId) await requireFolder(db, folderId);

	const uploaded: { id: string; original_filename: string }[] = [];

	for (const file of files) {
		const id = crypto.randomUUID();
		const r2Key = `originals/${id}`;
		const contentType = file.type ?? "application/octet-stream";
		// Copy to a standalone ArrayBuffer — exifr and R2 both read it.
		const bytes = file.data.buffer.slice(
			file.data.byteOffset,
			file.data.byteOffset + file.data.byteLength,
		) as ArrayBuffer;

		await bucket.put(r2Key, bytes, {
			httpMetadata: { contentType },
		});

		const exif = await extractExif(bytes);
		const exifId = crypto.randomUUID();

		try {
			await db.batch([
				db
					.prepare(
						`INSERT INTO photos (id, original_filename, r2_key, content_type, file_size)
						 VALUES (?, ?, ?, ?, ?)`,
					)
					.bind(id, file.filename, r2Key, contentType, file.data.byteLength),
				db
					.prepare(
						`INSERT INTO exif_data
							(id, photo_id, camera_make, camera_model, lens_info, exposure,
							 aperture, iso, focal_length, taken_at, gps_latitude, gps_longitude, other_data)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						exifId,
						id,
						exif.camera_make,
						exif.camera_model,
						exif.lens_info,
						exif.exposure,
						exif.aperture,
						exif.iso,
						exif.focal_length,
						exif.taken_at,
						exif.gps_latitude,
						exif.gps_longitude,
						exif.other_data,
					),
			]);
		} catch (err) {
			// D1 write failed — don't leave an orphaned R2 object behind.
			await bucket.delete(r2Key).catch(() => {});
			throw err;
		}

		uploaded.push({ id, original_filename: file.filename ?? id });
	}

	// Assign every freshly uploaded photo to the target folder (idempotent).
	if (folderId && uploaded.length > 0) {
		await db.batch(
			uploaded.map((p) =>
				db
					.prepare(
						"INSERT OR IGNORE INTO folder_photos (folder_id, photo_id) VALUES (?, ?)",
					)
					.bind(folderId, p.id),
			),
		);
	}

	return { ok: true, uploaded };
});
