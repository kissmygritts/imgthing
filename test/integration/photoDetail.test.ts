import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface UploadResponse {
	uploaded: { id: string }[];
}

async function upload(cookie: string, filename: string): Promise<string> {
	const form = new FormData();
	form.append(
		"file",
		new File([pngBytes()], filename, { type: "image/png" }),
		filename,
	);
	const res = await SELF.fetch(url("/api/photos"), {
		method: "POST",
		headers: { cookie },
		body: form,
	});
	expect(res.status, "upload should succeed").toBe(200);
	return ((await res.json()) as UploadResponse).uploaded[0].id;
}

describe("photo detail", () => {
	it("returns the full photo row including other_data for the owner", async () => {
		const cookie = await login();
		const id = await upload(cookie, `detail-${Date.now()}.png`);

		const res = await SELF.fetch(url(`/api/photos/${id}`), {
			headers: { cookie },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			photo: { id: string; other_data: string | null };
		};
		expect(body.photo.id).toBe(id);
		// other_data is present as a field (may be null for a photo with no EXIF —
		// the 1x1 test PNG carries none).
		expect(body.photo).toHaveProperty("other_data");
	});

	it("404s for an unknown photo id", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/photos/does-not-exist"), {
			headers: { cookie },
		});
		expect(res.status).toBe(404);
	});

	it("requires authentication", async () => {
		const cookie = await login();
		const id = await upload(cookie, `detail-auth-${Date.now()}.png`);

		const res = await SELF.fetch(url(`/api/photos/${id}`));
		expect(res.status).toBe(401);
	});
});
