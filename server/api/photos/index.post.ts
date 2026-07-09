// Upload limits — guard Worker memory against a runaway batch. A single request
// can pressure memory both by one huge file and by sheer file count, so we cap
// per-file size, file count, and the total batch bytes.
const MB = 1024 * 1024;
const MAX_FILE_BYTES = 60 * MB; // per-file ceiling — full-size Nikon Z8 JPGs run 20–50 MB
const MAX_FILE_COUNT = 50; // files per request
const MAX_TOTAL_BYTES = 500 * MB; // whole-batch ceiling

const mb = (bytes: number) => (bytes / MB).toFixed(1);

// Upload one or more images: original bytes stream to R2, metadata + EXIF to D1.
// An optional `folderId` text field assigns every uploaded photo to that folder.
defineRouteMeta({
	openAPI: {
		tags: ["Photos"],
		summary: "Upload photo",
		description:
			"Upload one or more images (multipart). Original bytes stream to R2, metadata + EXIF land in D1, and the three serving variants are precomputed. An optional `folderId` text field assigns every uploaded photo to that folder. Enforces per-file (60 MB), file-count (50), and total-batch (500 MB) limits; over-size files are skipped and reported in `rejected` while the rest still land.",
		security: [{ sessionCookie: [] }],
		requestBody: {
			required: true,
			content: {
				"multipart/form-data": {
					schema: {
						type: "object",
						properties: {
							file: {
								type: "string",
								format: "binary",
								description:
									"One or more image files (any part with an image/* content type).",
							},
							folderId: {
								type: "string",
								description:
									"Optional id of an existing folder to assign every uploaded photo to.",
							},
						},
					},
				},
			},
		},
		responses: {
			"200": {
				description:
					"Per-file successes and rejections. `uploaded` carries the new ids (with an optional `duplicateOf` flag); `rejected` names any over-limit files that were skipped.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								ok: { type: "boolean" },
								uploaded: {
									type: "array",
									items: {
										type: "object",
										properties: {
											id: { type: "string" },
											original_filename: { type: "string" },
											duplicateOf: {
												type: "object",
												properties: {
													id: { type: "string" },
													filename: { type: "string" },
												},
											},
										},
									},
								},
								rejected: {
									type: "array",
									items: {
										type: "object",
										properties: {
											filename: { type: "string" },
											reason: { type: "string" },
										},
									},
								},
							},
						},
					},
				},
			},
			"400": { description: "No image files in the upload." },
			"404": { description: "The target `folderId` does not exist." },
			"413": {
				description:
					"Upload too large — total batch, per-file size, or file count exceeds a limit, or no files were within the limits.",
			},
		},
	},
});

export default defineEventHandler(async (event) => {
	// Cheapest guard first: reject an oversized body by its declared length before
	// readMultipartFormData buffers the whole thing into memory.
	const contentLength = Number(getRequestHeader(event, "content-length") ?? 0);
	if (contentLength > MAX_TOTAL_BYTES) {
		throw createError({
			statusCode: 413,
			statusMessage: `Upload too large — the batch is ${mb(contentLength)} MB but the limit is ${MAX_TOTAL_BYTES / MB} MB`,
		});
	}

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

	// Guard count before any per-file work (byte copy, EXIF, R2 writes).
	if (files.length > MAX_FILE_COUNT) {
		throw createError({
			statusCode: 413,
			statusMessage: `Too many files — ${files.length} sent but the limit is ${MAX_FILE_COUNT} per upload`,
		});
	}

	const db = useDB(event);
	const bucket = useBucket(event);
	const images = useImages(event);

	// Validate the target folder up front so we never upload bytes to R2 only to
	// discover the folder doesn't exist (requireFolder throws a 404).
	if (folderId) await requireFolder(db, folderId);

	const uploaded: {
		id: string;
		original_filename: string;
		// Present only when this file's bytes match an existing live photo. Non-blocking:
		// the upload still lands — this just flags a likely duplicate for the user.
		duplicateOf?: { id: string; filename: string };
	}[] = [];
	// Per-file rejections (over-size) — surfaced alongside successes so a mixed
	// batch reports why each bad file didn't land, mirroring the upload page.
	const rejected: { filename: string; reason: string }[] = [];
	let totalBytes = 0;

	for (const file of files) {
		const name = file.filename ?? "unnamed";
		const size = file.data.byteLength;

		// Skip (don't process) an over-size file, but tell the caller which and why.
		if (size > MAX_FILE_BYTES) {
			rejected.push({
				filename: name,
				reason: `${name} is ${mb(size)} MB — exceeds the ${MAX_FILE_BYTES / MB} MB per-file limit`,
			});
			continue;
		}
		totalBytes += size;
		if (totalBytes > MAX_TOTAL_BYTES) {
			rejected.push({
				filename: name,
				reason: `${name} skipped — the batch exceeds the ${MAX_TOTAL_BYTES / MB} MB total limit`,
			});
			continue;
		}

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

		// SHA-256 of the original bytes → hex, for duplicate detection. If hashing
		// ever fails, leave the hash NULL and skip the duplicate check (non-fatal).
		let contentHash: string | null = null;
		let duplicateOf: { id: string; filename: string } | undefined;
		try {
			const digest = await crypto.subtle.digest("SHA-256", bytes);
			contentHash = [...new Uint8Array(digest)]
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");
			const match = await db
				.prepare(
					"SELECT id, original_filename FROM photos WHERE content_hash = ? AND deleted_at IS NULL LIMIT 1",
				)
				.bind(contentHash)
				.first<{ id: string; original_filename: string }>();
			if (match) {
				duplicateOf = { id: match.id, filename: match.original_filename };
			}
		} catch (err) {
			console.error(`Content hashing failed for upload ${id}:`, err);
		}

		const exif = await extractExif(bytes);
		const exifId = crypto.randomUUID();

		// True pixel dimensions from the image itself — EXIF's declared dimensions
		// are unreliable (often absent), so prefer info() and only fall back to EXIF.
		const dims = await imageDimensions(images, bytes);
		const width = dims?.width ?? exif.width;
		const height = dims?.height ?? exif.height;

		try {
			await db.batch([
				db
					.prepare(
						`INSERT INTO photos (id, original_filename, r2_key, content_type, file_size, content_hash)
						 VALUES (?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						id,
						file.filename,
						r2Key,
						contentType,
						file.data.byteLength,
						contentHash,
					),
				db
					.prepare(
						`INSERT INTO exif_data
							(id, photo_id, camera_make, camera_model, lens_info, exposure,
							 aperture, iso, focal_length, taken_at, gps_latitude, gps_longitude,
							 width, height, other_data)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
						width,
						height,
						exif.other_data,
					),
			]);
		} catch (err) {
			// D1 write failed — don't leave an orphaned R2 object behind.
			await bucket.delete(r2Key).catch(() => {});
			throw err;
		}

		// Precompute the three serving variants now so serving is a pure R2 read.
		// The row + original are already durable, so a generation failure must not
		// fail the upload — serving self-heals on a variant miss. Leave
		// variants_generated_at NULL on failure so a later serve regenerates.
		try {
			const variantBytes = await generateVariants(images, bucket, id, bytes);
			await db
				.prepare(
					"UPDATE photos SET variants_generated_at = datetime('now'), variant_bytes = ? WHERE id = ?",
				)
				.bind(variantBytes, id)
				.run();
		} catch (err) {
			console.error(`Variant generation failed for photo ${id}:`, err);
		}

		uploaded.push({
			id,
			original_filename: file.filename ?? id,
			...(duplicateOf ? { duplicateOf } : {}),
		});
	}

	// Nothing landed — every file was over-limit. Surface a 4xx (naming the first
	// offender + limit) so callers don't mistake an empty 200 for success.
	if (uploaded.length === 0) {
		throw createError({
			statusCode: 413,
			statusMessage:
				rejected[0]?.reason ?? "No files were within the upload limits",
		});
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

	return { ok: true, uploaded, rejected };
});
