// App secrets (from .dev.vars in dev, `wrangler secret put` in prod), merged
// into the generated Cloudflare `Env` interface so `cf(event)` types them.
export {};

declare global {
	interface Env {
		/** The single owner's login passphrase. */
		APP_PASSPHRASE: string;
		/** HMAC key used to sign session cookies. */
		SESSION_SECRET: string;
	}
}
