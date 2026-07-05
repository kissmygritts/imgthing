import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, TEST_PASSPHRASE, url } from "./helpers";

describe("auth", () => {
	it("rejects a wrong passphrase with 401 and no cookie", async () => {
		const res = await SELF.fetch(url("/api/auth/login"), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ passphrase: "wrong" }),
		});
		expect(res.status).toBe(401);
		expect(res.headers.get("set-cookie")).toBeNull();
	});

	it("accepts the correct passphrase and issues a session", async () => {
		const cookie = await login(TEST_PASSPHRASE);
		expect(cookie).toContain("imgthing_session=");

		const session = await SELF.fetch(url("/api/auth/session"), {
			headers: { cookie },
		});
		expect(await session.json()).toEqual({ loggedIn: true });
	});

	it("reports logged-out without a cookie", async () => {
		const res = await SELF.fetch(url("/api/auth/session"));
		expect(await res.json()).toEqual({ loggedIn: false });
	});

	it("logout clears the session cookie", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/auth/logout"), {
			method: "POST",
			headers: { cookie },
		});
		expect(res.status).toBe(200);
		// A clearing cookie is sent with an immediate/expired max-age.
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie.toLowerCase()).toContain("max-age=0");
	});

	it("guards protected API routes when unauthenticated", async () => {
		const res = await SELF.fetch(url("/api/photos"));
		expect(res.status).toBe(401);
	});

	it("rejects a tampered session cookie", async () => {
		const res = await SELF.fetch(url("/api/photos"), {
			headers: { cookie: "imgthing_session=not.a.valid.token" },
		});
		expect(res.status).toBe(401);
	});
});
