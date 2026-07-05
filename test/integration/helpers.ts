import { SELF } from "cloudflare:test";
import { expect } from "vitest";

// The passphrase configured in test/integration/wrangler.jsonc.
export const TEST_PASSPHRASE = "test-pass";

const BASE = "https://example.com";

export function url(path: string): string {
	return `${BASE}${path}`;
}

/** Log in and return the session cookie as a `name=value` string for `Cookie` headers. */
export async function login(passphrase = TEST_PASSPHRASE): Promise<string> {
	const res = await SELF.fetch(url("/api/auth/login"), {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ passphrase }),
	});
	expect(res.status, "login should succeed").toBe(200);
	const setCookie = res.headers.get("set-cookie");
	expect(setCookie, "login should set a session cookie").toBeTruthy();
	// Strip attributes (Path, HttpOnly, ...) — keep just the leading name=value.
	return (setCookie as string).split(";")[0];
}

/** A tiny valid 1x1 PNG (no EXIF), as raw bytes. */
export function pngBytes(): Uint8Array {
	return Uint8Array.from(
		atob(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
		),
		(c) => c.charCodeAt(0),
	);
}
