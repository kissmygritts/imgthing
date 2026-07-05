// Serve a resized WebP variant of a photo via the Cloudflare Images binding,
// so grid tiles and the lightbox don't pull full-size originals. The R2
// original is loaded, transformed to the requested width, and streamed back
// with a long cache lifetime. The untransformed original stays on `raw`.
const SIZES = { thumb: 320, md: 1024, lg: 1600 } as const;
type Size = keyof typeof SIZES;

function isSize(value: string | undefined): value is Size {
	return value != null && value in SIZES;
}

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id");
	if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

	const size = getQuery(event).size;
	const sizeKey = typeof size === "string" ? size : undefined;
	if (!isSize(sizeKey)) {
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
		.transform({ width: SIZES[sizeKey] })
		.output({ format: "image/webp" });

	setHeader(event, "content-type", "image/webp");
	setHeader(event, "cache-control", "private, max-age=31536000, immutable");
	return result.image();
});
