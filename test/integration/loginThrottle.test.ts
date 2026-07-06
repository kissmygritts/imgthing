import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { TEST_PASSPHRASE, url } from "./helpers";

// Fire a login attempt as a specific client IP (CF-Connecting-IP is trusted by
// the throttle). Distinct IPs per test keep the isolated D1 rows from colliding.
function attempt(ip: string, passphrase: string): Promise<Response> {
	return SELF.fetch(url("/api/auth/login"), {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"cf-connecting-ip": ip,
		},
		body: JSON.stringify({ passphrase }),
	});
}

describe("login throttle", () => {
	it("locks an IP out after repeated failures, even with the right passphrase", async () => {
		const ip = "203.0.113.1";
		// The free allowance is 5 wrong attempts (all 401), then the 6th arms a lock.
		for (let i = 0; i < 6; i++) {
			const res = await attempt(ip, "wrong");
			expect(res.status).toBe(401);
		}

		// Now even the correct passphrase is rejected with 429 + Retry-After —
		// proving the lock short-circuits before the passphrase compare.
		const locked = await attempt(ip, TEST_PASSPHRASE);
		expect(locked.status).toBe(429);
		expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);
		expect(locked.headers.get("set-cookie")).toBeNull();
	});

	it("throttles per-IP — a different IP is unaffected", async () => {
		const bad = "203.0.113.2";
		for (let i = 0; i < 6; i++) await attempt(bad, "wrong");
		expect((await attempt(bad, TEST_PASSPHRASE)).status).toBe(429);

		// A fresh IP still authenticates normally.
		const ok = await attempt("203.0.113.3", TEST_PASSPHRASE);
		expect(ok.status).toBe(200);
		expect(ok.headers.get("set-cookie")).toContain("imgthing_session=");
	});

	it("resets the failure counter on a successful login", async () => {
		const ip = "203.0.113.4";
		// Four failures — under the threshold, so no lock yet.
		for (let i = 0; i < 4; i++) {
			expect((await attempt(ip, "wrong")).status).toBe(401);
		}
		// A success clears the row.
		expect((await attempt(ip, TEST_PASSPHRASE)).status).toBe(200);

		// The counter is reset: the next wrong attempt is a plain 401, not a 429,
		// which it would be if the earlier four still counted.
		expect((await attempt(ip, "wrong")).status).toBe(401);
	});
});
