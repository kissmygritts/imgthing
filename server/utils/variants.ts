// Fixed WebP variants, precomputed on upload and stored in R2 (self-healing on a
// serving miss). Centralizes the sizing, R2 keys, and generate logic shared by
// the upload path and every serving route (raw stays untransformed; variants are
// served straight from R2 without touching the Images binding).
//
// Sizes are the longest-side bounding box in device pixels, tuned for 2x (retina)
// rendering: grid tiles are ~260-300 CSS px and the lightbox fills large
// viewports. Under-sizing here is what makes tiles look fuzzy on retina, so
// `thumb` covers a 2x tile and `lg` covers a 2x full view.
//
// The transform bounds the *longest* side to N with `fit: "scale-down"` (never
// upscales). A longest-side bound gives portrait, landscape, and square originals
// an equal pixel budget, so a tall portrait is no longer forced wider (and
// heavier) than a landscape at the same tier. The grid tile does its own square
// crop via CSS object-cover, so the variant keeps the original aspect ratio.
//
// IMPORTANT: we constrain a *single* dimension (width for landscape, height for
// portrait), NOT both. Passing both width and height with scale-down/contain pads
// the output to the full N×N box (with a black background) in the Images runtime,
// which then shows as letterboxing under object-cover. Constraining one dimension
// per orientation bounds the longest side with no padding. `generateVariants`
// reads the orientation once via `images.info()` and reuses it for all sizes.
export const VARIANT_SIZES = { thumb: 800, md: 1280, lg: 2560 } as const;
export type VariantSize = keyof typeof VARIANT_SIZES;

export function isVariantSize(v: string | undefined): v is VariantSize {
	return v != null && v in VARIANT_SIZES;
}

/** R2 key for a photo's variant at a given size. */
export function variantKey(photoId: string, size: VariantSize): string {
	return `variants/${photoId}/${size}`;
}

// WebP output always discards EXIF metadata (see the `metadata` note in
// worker-configuration.d.ts), so variant bytes carry no location/camera data —
// P8 asserts this. Quality 88 is a good size/fidelity tradeoff for photos.
async function transformVariant(
	images: ImagesBinding,
	original: ArrayBuffer,
	size: VariantSize,
	portrait: boolean,
): Promise<ArrayBuffer> {
	const n = VARIANT_SIZES[size];
	// Bound only the longest side — a single dimension, or the binding pads to an
	// N×N black box (see the VARIANT_SIZES comment). Fresh stream per size: the
	// binding consumes its input stream, so it can't be reused across transforms.
	const bound = portrait ? { height: n } : { width: n };
	const result = await images
		.input(new Response(original).body as ReadableStream<Uint8Array>)
		.transform({ ...bound, fit: "scale-down" })
		.output({ format: "image/webp", quality: 88 });
	// R2 put needs a known length, and image() returns a stream — buffer it.
	return await new Response(result.image()).arrayBuffer();
}

/**
 * Generate and store all fixed variants for a photo. Originals are capped at
 * 25 MB (the upload limit), so three sequential buffered transforms stay within
 * Worker memory — do them sequentially rather than Promise.all.
 */
export async function generateVariants(
	images: ImagesBinding,
	bucket: R2Bucket,
	photoId: string,
	original: ArrayBuffer,
): Promise<void> {
	// Read orientation once and reuse for every size. On anything without pixel
	// dimensions (e.g. SVG) or an info failure, fall back to width-bound (landscape).
	let portrait = false;
	try {
		const info = await images.info(
			new Response(original).body as ReadableStream<Uint8Array>,
		);
		if ("width" in info && "height" in info) {
			portrait = info.height > info.width;
		}
	} catch {
		portrait = false;
	}

	for (const size of Object.keys(VARIANT_SIZES) as VariantSize[]) {
		const bytes = await transformVariant(images, original, size, portrait);
		await bucket.put(variantKey(photoId, size), bytes, {
			httpMetadata: { contentType: "image/webp" },
		});
	}
}

/**
 * Return the bytes of a photo's variant at `size`. On an R2 hit, stream straight
 * from R2. On a miss, self-heal: load the original (404 if it's gone), regenerate
 * *all* sizes (a miss for one usually means all are missing, so generating every
 * size avoids three separate heal round-trips), stamp `variants_generated_at`, and
 * return the requested size.
 */
export async function getOrCreateVariant(
	db: D1Database,
	images: ImagesBinding,
	bucket: R2Bucket,
	photo: { id: string; r2_key: string },
	size: VariantSize,
): Promise<ReadableStream<Uint8Array>> {
	const hit = await bucket.get(variantKey(photo.id, size));
	if (hit) return hit.body;

	const original = await bucket.get(photo.r2_key);
	if (!original) {
		throw createError({ statusCode: 404, statusMessage: "Object missing" });
	}

	await generateVariants(
		images,
		bucket,
		photo.id,
		await original.arrayBuffer(),
	);
	await db
		.prepare(
			"UPDATE photos SET variants_generated_at = datetime('now') WHERE id = ?",
		)
		.bind(photo.id)
		.run();

	const created = await bucket.get(variantKey(photo.id, size));
	if (!created) {
		throw createError({ statusCode: 404, statusMessage: "Object missing" });
	}
	return created.body;
}
