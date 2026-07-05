import type { H3Event } from "h3";

/**
 * The Worker env: wrangler-generated bindings (`Env`) plus the app secrets
 * injected at runtime (`.dev.vars` locally, `wrangler secret put` in prod).
 * Declared explicitly here rather than via ambient `interface Env` merging,
 * which vue-tsc doesn't apply across files under Nuxt's server tsconfig.
 */
export interface AppEnv extends Env {
	/** The single owner's login passphrase. */
	APP_PASSPHRASE: string;
	/** HMAC key used to sign session cookies. */
	SESSION_SECRET: string;
}

/**
 * Cloudflare Worker bindings (D1, R2, Images) for the current request.
 * In dev these are provided by nitro-cloudflare-dev via miniflare.
 */
export function cf(event: H3Event): AppEnv {
	const env = (
		event.context.cloudflare as unknown as { env?: AppEnv } | undefined
	)?.env;
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
