import { defineConfig } from "vitest/config";

// Fast, runtime-free unit tests for pure server utils (no Cloudflare bindings).
export default defineConfig({
	test: {
		name: "unit",
		include: ["test/unit/**/*.test.ts"],
		environment: "node",
	},
});
