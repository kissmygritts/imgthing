// Serve a resized WebP variant of a photo via the Cloudflare Images binding,
// so grid tiles and the lightbox don't pull full-size originals. The R2
// original is loaded, transformed to the requested size, and streamed back
// with a long cache lifetime. The untransformed original stays on `raw`.
// Sizing/keys/generation live in server/utils/variants.ts; P4 rewrites this
// route to serve precomputed variants straight from R2 via getOrCreateVariant.
export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id");
	if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

	const size = getQuery(event).size;
	const sizeKey: string | undefined =
		typeof size === "string" ? size : undefined;
	if (!isVariantSize(sizeKey)) {
		throw createError({ statusCode: 400, statusMessage: "Unknown size" });
	}

	const row = await useDB(event)
		.prepare("SELECT r2_key FROM photos WHERE id = ?")
		.bind(id)
		.first<{ r2_key: string }>();
	if (!row) throw createError({ statusCode: 404, statusMessage: "Not found" });

	const object = await useBucket(event).get(row.r2_key);
	if (!object) {
		throw createError({ statusCode: 404, statusMessage: "Object missing" });
	}

	const result = await useImages(event)
		.input(object.body)
		.transform({
			width: VARIANT_SIZES[sizeKey],
			height: VARIANT_SIZES[sizeKey],
			fit: "scale-down",
		})
		.output({ format: "image/webp", quality: 88 });

	setHeader(event, "content-type", "image/webp");
	setHeader(event, "cache-control", "private, max-age=31536000, immutable");
	return result.image();
});
