import type { H3Event } from "h3";

/**
 * Cloudflare Worker bindings (D1, R2, Images) for the current request.
 * In dev these are provided by nitro-cloudflare-dev via miniflare.
 */
export function cf(event: H3Event): Env {
	const env = (event.context.cloudflare as { env?: Env } | undefined)?.env;
	if (!env) {
		throw createError({
			statusCode: 500,
			statusMessage: "Cloudflare bindings are not available in this context.",
		});
	}
	return env;
}

export function useDB(event: H3Event): D1Database {
	return cf(event).DB;
}

export function useBucket(event: H3Event): R2Bucket {
	return cf(event).BUCKET;
}

export function useImages(event: H3Event): ImagesBinding {
	return cf(event).IMAGES;
}
