// Serve a precomputed WebP variant of a photo straight from R2, so grid tiles
// and the lightbox don't pull full-size originals. The row's `r2_key` locates the
// original for self-healing; getOrCreateVariant streams the requested size from
// R2 (regenerating on a miss). Session-gated via server/middleware/auth.ts.
// Sizing/keys/generation live in server/utils/variants.ts. `raw` stays untransformed.
defineRouteMeta({
	openAPI: {
		tags: ["Photos"],
		summary: "Get WebP variant",
		description:
			"Serve a precomputed WebP variant of a photo straight from R2 (self-healing: regenerates from the original on a miss). Session-gated.",
		security: [{ sessionCookie: [] }],
		parameters: [
			{ name: "id", in: "path", required: true, schema: { type: "string" } },
			{
				name: "size",
				in: "query",
				required: true,
				description: "Variant size key.",
				schema: { type: "string", enum: ["thumb", "md", "lg"] },
			},
		],
		responses: {
			"200": {
				description: "The WebP variant bytes.",
				content: {
					"image/webp": { schema: { type: "string", format: "binary" } },
				},
			},
			"400": { description: "Missing id, or unknown `size`." },
			"404": { description: "Photo not found." },
		},
	},
});

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
		.prepare("SELECT id, r2_key FROM photos WHERE id = ?")
		.bind(id)
		.first<{ id: string; r2_key: string }>();
	if (!row) throw createError({ statusCode: 404, statusMessage: "Not found" });

	const stream = await getOrCreateVariant(
		useDB(event),
		useImages(event),
		useBucket(event),
		row,
		sizeKey,
	);

	setHeader(event, "content-type", "image/webp");
	setHeader(event, "cache-control", "private, max-age=31536000, immutable");
	return stream;
});
