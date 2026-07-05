// Serve a resized WebP variant of a photo via the Cloudflare Images binding,
// so grid tiles and the lightbox don't pull full-size originals. The R2
// original is loaded, transformed to the requested width, and streamed back
// with a long cache lifetime. The untransformed original stays on `raw`.
// Widths are sized for 2x (retina) rendering: grid tiles are ~260-300 CSS px,
// the lightbox fills large viewports. Under-sizing here is what makes tiles look
// fuzzy on retina, so thumb covers a 2x tile and lg covers a 2x full view.
// Width-only, aspect-preserving resize (the binding never upscales past the
// original). The grid tile does its own square crop via CSS object-cover, so we
// must NOT ask the binding for a square here — its `fit: cover` pads to black in
// local dev instead of cropping. `thumb` is wide enough that a landscape crop
// still lands ~540px on the short side, i.e. crisp on a 2x retina tile.
const SIZES = { thumb: 800, md: 1280, lg: 2560 } as const;
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
		.output({ format: "image/webp", quality: 88 });

	setHeader(event, "content-type", "image/webp");
	setHeader(event, "cache-control", "private, max-age=31536000, immutable");
	return result.image();
});
