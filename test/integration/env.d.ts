import type { D1Migration } from "@cloudflare/vitest-pool-workers";

// Extra bindings provided to tests via the pool config (see vitest.integration.config.ts).
declare global {
	namespace Cloudflare {
		interface Env {
			TEST_MIGRATIONS: D1Migration[];
		}
	}
}
