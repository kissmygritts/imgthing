import { SELF } from "cloudflare:test";
import { expect, it } from "vitest";

it("health reports D1 + R2 bindings are live", async () => {
	const res = await SELF.fetch("https://example.com/api/health");
	expect(res.status).toBe(200);
	const body = (await res.json()) as {
		ok: boolean;
		bindings: { DB: boolean; BUCKET: boolean };
	};
	expect(body.ok).toBe(true);
	expect(body.bindings.DB).toBe(true);
	expect(body.bindings.BUCKET).toBe(true);
});
