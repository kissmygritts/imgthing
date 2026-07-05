import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

// The public token shape enforced by both public routes (16 random bytes, hex).
const TOKEN_RE = /^[0-9a-f]{32}$/;

// A tiny valid baseline JPEG that carries an EXIF APP1 segment (the literal
// "Exif\0\0" marker at offset 24). Produced once with `sips -s format jpeg` from
// the 1x1 test PNG; sips stamps a JFIF/Exif/Photoshop header block. Used by the
// EXIF-stripping scenario: after the WebP transform the marker must be gone.
const JPEG_WITH_EXIF_B64 =
	"/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+";

function jpegWithExif(): Uint8Array {
	return Uint8Array.from(atob(JPEG_WITH_EXIF_B64), (c) => c.charCodeAt(0));
}

// The ASCII bytes of the JPEG EXIF APP1 marker: "Exif\0\0".
const EXIF_MARKER = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
	outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
		for (let j = 0; j < needle.length; j++) {
			if (haystack[i + j] !== needle[j]) continue outer;
		}
		return true;
	}
	return false;
}

interface PublishResponse {
	token: string;
	urls: { thumb: string; md: string; lg: string; meta: string };
}

/** Upload a photo through the real API and return its id. */
async function upload(
	cookie: string,
	filename: string,
	bytes: Uint8Array = pngBytes(),
	type = "image/png",
): Promise<string> {
	const form = new FormData();
	form.append("file", new File([bytes], filename, { type }), filename);
	const res = await SELF.fetch(url("/api/photos"), {
		method: "POST",
		headers: { cookie },
		body: form,
	});
	expect(res.status, "upload should succeed").toBe(200);
	return ((await res.json()) as { uploaded: { id: string }[] }).uploaded[0].id;
}

/** Publish a photo and return the mint response. */
async function publish(
	cookie: string,
	id: string,
	showLocation?: boolean,
): Promise<PublishResponse> {
	const res = await SELF.fetch(url(`/api/photos/${id}/publish`), {
		method: "POST",
		headers: { cookie, "content-type": "application/json" },
		body: JSON.stringify(showLocation === undefined ? {} : { showLocation }),
	});
	expect(res.status, "publish should succeed").toBe(200);
	return (await res.json()) as PublishResponse;
}

async function unpublish(cookie: string, id: string): Promise<void> {
	const res = await SELF.fetch(url(`/api/photos/${id}/unpublish`), {
		method: "POST",
		headers: { cookie },
	});
	expect(res.status, "unpublish should succeed").toBe(200);
}

/** Public GET with NO session cookie — the real unauthenticated surface. */
function pub(path: string): Promise<Response> {
	return SELF.fetch(url(path));
}

describe("public: publish + auth", () => {
	it("requires auth to publish (401 without a session cookie)", async () => {
		const res = await SELF.fetch(url("/api/photos/whatever/publish"), {
			method: "POST",
		});
		expect(res.status).toBe(401);
	});

	it("mints a 32-hex token plus fully-qualified public urls", async () => {
		const cookie = await login();
		const id = await upload(cookie, "publish-me.png");
		const { token, urls } = await publish(cookie, id);

		expect(token).toMatch(TOKEN_RE);
		// URLs are fully-qualified against the request origin (scheme varies by the
		// test transport), so assert the path suffix rather than a hardcoded scheme.
		expect(urls.thumb).toMatch(/^https?:\/\/example\.com\/p\//);
		expect(urls.thumb.endsWith(`/p/${token}/thumb`)).toBe(true);
		expect(urls.md.endsWith(`/p/${token}/md`)).toBe(true);
		expect(urls.lg.endsWith(`/p/${token}/lg`)).toBe(true);
		expect(urls.meta.endsWith(`/p/${token}/meta`)).toBe(true);
	});
});

describe("public: variant serving", () => {
	it("serves /p/{token}/md webp WITHOUT a session cookie, publicly cacheable", async () => {
		const cookie = await login();
		const id = await upload(cookie, "served.png");
		const { token } = await publish(cookie, id);

		const res = await pub(`/p/${token}/md`);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("image/webp");
		expect(res.headers.get("cache-control")).toContain("public");
		const bytes = new Uint8Array(await res.arrayBuffer());
		expect(bytes.byteLength).toBeGreaterThan(0);
	});
});

describe("public: uniform 404s", () => {
	it("404s every failure identically (bad shape, unknown token, bad size, unpublished, trashed)", async () => {
		const cookie = await login();

		// Malformed token (fails the shape guard before D1).
		expect((await pub("/p/not-a-real-token/md")).status).toBe(404);

		// Valid 32-hex shape but no matching row.
		const orphan = "0".repeat(32);
		expect(orphan).toMatch(TOKEN_RE);
		expect((await pub(`/p/${orphan}/md`)).status).toBe(404);

		// A real, live token but a size outside the allowlist.
		const liveId = await upload(cookie, "sizes.png");
		const { token: liveTok } = await publish(cookie, liveId);
		expect((await pub(`/p/${liveTok}/huge`)).status).toBe(404);
		// (sanity: an allowed size on the same token does resolve)
		expect((await pub(`/p/${liveTok}/thumb`)).status).toBe(200);

		// Token of a photo that was published then unpublished.
		const unpubId = await upload(cookie, "unpub.png");
		const { token: unpubTok } = await publish(cookie, unpubId);
		await unpublish(cookie, unpubId);
		expect((await pub(`/p/${unpubTok}/md`)).status).toBe(404);

		// Token of a photo that was published then trashed (soft-deleted).
		const trashId = await upload(cookie, "trash.png");
		const { token: trashTok } = await publish(cookie, trashId);
		await SELF.fetch(url(`/api/photos/${trashId}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect((await pub(`/p/${trashTok}/md`)).status).toBe(404);
	});
});

describe("public: token rotation", () => {
	it("publish → unpublish → publish yields a new token; the first 404s", async () => {
		const cookie = await login();
		const id = await upload(cookie, "rotate.png");

		const { token: first } = await publish(cookie, id);
		expect((await pub(`/p/${first}/md`)).status).toBe(200);

		await unpublish(cookie, id);
		const { token: second } = await publish(cookie, id);

		expect(second).not.toBe(first);
		expect(second).toMatch(TOKEN_RE);
		// The old URL is dead; the new one resolves.
		expect((await pub(`/p/${first}/md`)).status).toBe(404);
		expect((await pub(`/p/${second}/md`)).status).toBe(200);
	});
});

describe("public: trash implies unpublish", () => {
	it("soft-delete revokes the share: old token 404s (public_token cleared)", async () => {
		const cookie = await login();
		const id = await upload(cookie, "trash-unpub.png");
		const { token } = await publish(cookie, id);

		// Live and serving before the delete.
		expect((await pub(`/p/${token}/md`)).status).toBe(200);
		expect((await pub(`/p/${token}/meta`)).status).toBe(200);

		await SELF.fetch(url(`/api/photos/${id}`), {
			method: "DELETE",
			headers: { cookie },
		});

		// The only API-observable proxy for `public_token IS NULL`: the old share
		// URLs stop resolving through both public routes.
		expect((await pub(`/p/${token}/md`)).status).toBe(404);
		expect((await pub(`/p/${token}/meta`)).status).toBe(404);
	});
});

describe("public: meta endpoint", () => {
	it("hides GPS by default, exposes it with showLocation, never leaks id/r2_key, 404s after unpublish", async () => {
		const cookie = await login();
		const id = await upload(cookie, "meta.png");

		// Seed GPS on the exif_data row the upload created (the 1x1 PNG has none),
		// mirroring the geo test — a real geotagged image.
		const lat = 37.8199;
		const lng = -122.4783;
		await env.DB.prepare(
			"UPDATE exif_data SET gps_latitude = ?, gps_longitude = ? WHERE photo_id = ?",
		)
			.bind(lat, lng, id)
			.run();

		// Default publish: GPS opt-in is OFF, so coordinates are withheld.
		const { token: privTok } = await publish(cookie, id);
		const privRes = await pub(`/p/${privTok}/meta`);
		expect(privRes.status).toBe(200);
		const priv = (await privRes.json()) as Record<string, unknown>;
		expect(priv.gps).toBeNull();
		// No internal identifiers ever appear in the public JSON.
		expect(Object.keys(priv)).not.toContain("id");
		expect(Object.keys(priv)).not.toContain("r2_key");
		expect(JSON.stringify(priv)).not.toContain("r2_key");

		// Re-publish with showLocation: true → a new token that DOES expose GPS.
		await unpublish(cookie, id);
		const { token: geoTok } = await publish(cookie, id, true);
		const geoRes = await pub(`/p/${geoTok}/meta`);
		expect(geoRes.status).toBe(200);
		const geo = (await geoRes.json()) as {
			gps: { latitude: number; longitude: number } | null;
		};
		expect(geo.gps).not.toBeNull();
		expect(geo.gps?.latitude).toBeCloseTo(lat, 4);
		expect(geo.gps?.longitude).toBeCloseTo(lng, 4);

		// Unpublishing revokes the meta endpoint too.
		await unpublish(cookie, id);
		expect((await pub(`/p/${geoTok}/meta`)).status).toBe(404);
	});
});

describe("public: variant self-heal", () => {
	it("regenerates a deleted variant object on the next request (both routes 200 webp)", async () => {
		const cookie = await login();
		const id = await upload(cookie, "selfheal.png");
		const { token } = await publish(cookie, id);

		// Prime the cache: this serve generates + stores all variants in R2.
		expect((await pub(`/p/${token}/md`)).status).toBe(200);

		// Delete the `md` variant object straight out of R2 (the binding name is
		// BUCKET; variantKey format is variants/{id}/{size}).
		await env.BUCKET.delete(`variants/${id}/md`);
		expect(await env.BUCKET.get(`variants/${id}/md`)).toBeNull();

		// The public route self-heals (regenerates on the miss) and still serves webp.
		const healed = await pub(`/p/${token}/md`);
		expect(healed.status).toBe(200);
		expect(healed.headers.get("content-type")).toBe("image/webp");
		expect(
			new Uint8Array(await healed.arrayBuffer()).byteLength,
		).toBeGreaterThan(0);

		// Delete again and confirm the authenticated /variant route heals too.
		await env.BUCKET.delete(`variants/${id}/md`);
		const priv = await SELF.fetch(url(`/api/photos/${id}/variant?size=md`), {
			headers: { cookie },
		});
		expect(priv.status).toBe(200);
		expect(priv.headers.get("content-type")).toBe("image/webp");
	});
});

describe("public: EXIF stripping", () => {
	it("strips the EXIF marker from public variant bytes", async () => {
		const cookie = await login();
		const original = jpegWithExif();
		// Sanity: the source really does carry the "Exif\0\0" marker.
		expect(contains(original, EXIF_MARKER)).toBe(true);

		const id = await upload(cookie, "exif.jpg", original, "image/jpeg");
		const { token } = await publish(cookie, id);

		const res = await pub(`/p/${token}/md`);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("image/webp");
		const bytes = new Uint8Array(await res.arrayBuffer());

		// The WebP re-encode must not carry the JPEG APP1 EXIF marker. If miniflare's
		// local Images simulation ever became a passthrough (returning the original
		// JPEG bytes), this assertion would catch it — the marker would survive.
		expect(contains(bytes, EXIF_MARKER)).toBe(false);
	});
});
