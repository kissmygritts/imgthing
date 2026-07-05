import { fileURLToPath } from "node:url";
import {
	cloudflareTest,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Integration tests run inside workerd against the built nitro worker, with
// real isolated D1 + R2 per test. Requires `npm run build` first (the worker
// entry comes from test/integration/wrangler.jsonc's `main` → .output/server).
// D1 migrations are read here and applied per test in setup.ts via TEST_MIGRATIONS.
const migrations = await readD1Migrations(
	fileURLToPath(new URL("./server/db/migrations", import.meta.url)),
);

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./test/integration/wrangler.jsonc" },
			miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
		}),
	],
	test: {
		name: "integration",
		include: ["test/integration/**/*.test.ts"],
		setupFiles: ["./test/integration/setup.ts"],
	},
});
