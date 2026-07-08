import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Static completeness guard for the OpenAPI annotations. The generated spec is
// dev-only (nitro `experimental.openAPI` doesn't emit `/_openapi.json` in the
// production build the integration suite runs against), so we can't fetch it —
// instead we scan the source of truth: every `server/api/**` handler must carry
// a `defineRouteMeta({ openAPI })` block with a summary, responses, and the
// security matching its gating. New endpoint ⇒ new annotation, enforced by the
// gate. See CLAUDE.md ("New/changed API endpoint").

const API_DIR = join(process.cwd(), "server", "api");
const METHOD_RE = /\.(get|post|patch|delete|put)\.ts$/;

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(p));
		else if (METHOD_RE.test(entry.name)) out.push(p);
	}
	return out;
}

// `/api/auth/*` and `/api/health` are the only ungated routes (see
// server/middleware/auth.ts); every other route requires the session cookie.
function isPublic(rel: string): boolean {
	return rel.startsWith("auth/") || rel === "health.get.ts";
}

const files = walk(API_DIR).map(
	(f) => [relative(API_DIR, f).split(sep).join("/"), f] as const,
);

describe("OpenAPI annotation completeness", () => {
	it("discovers the api route handlers", () => {
		// Guard against the walk silently finding nothing (e.g. a moved dir).
		expect(files.length).toBeGreaterThanOrEqual(39);
	});

	it.each(files)("%s carries OpenAPI route meta", (rel, file) => {
		const src = readFileSync(file, "utf8");
		expect(src, `${rel}: missing defineRouteMeta`).toContain(
			"defineRouteMeta(",
		);
		expect(src, `${rel}: missing openAPI meta`).toContain("openAPI:");
		expect(src, `${rel}: missing summary`).toContain("summary:");
		expect(src, `${rel}: missing responses`).toContain("responses:");
		if (isPublic(rel)) {
			expect(src, `${rel}: ungated route must be security: []`).toContain(
				"security: []",
			);
		} else {
			expect(
				src,
				`${rel}: gated route must require the sessionCookie scheme`,
			).toContain("security: [{ sessionCookie: [] }]");
		}
	});
});
