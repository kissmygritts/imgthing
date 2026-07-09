import { env, SELF } from "cloudflare:test";
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
			photo: {
				id: string;
				other_data: string | null;
				width: number | null;
				height: number | null;
			};
		};
		expect(body.photo.id).toBe(id);
		// other_data is present as a field (may be null for a photo with no EXIF —
		// the 1x1 test PNG carries none).
		expect(body.photo).toHaveProperty("other_data");
		// Dimensions are first-class columns captured at upload — the 1x1 test PNG
		// reports 1x1.
		expect(body.photo.width).toBe(1);
		expect(body.photo.height).toBe(1);
	});

	it("self-heals null dimensions from the original on detail view", async () => {
		const cookie = await login();
		const id = await upload(cookie, `detail-backfill-${Date.now()}.png`);

		// Simulate a pre-0010 row (or one whose EXIF declared no dimensions).
		await env.DB.prepare(
			"UPDATE exif_data SET width = NULL, height = NULL WHERE photo_id = ?",
		)
			.bind(id)
			.run();

		const res = await SELF.fetch(url(`/api/photos/${id}`), {
			headers: { cookie },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			photo: { width: number | null; height: number | null };
		};
		// Measured directly from the 1x1 PNG via the Images binding.
		expect(body.photo.width).toBe(1);
		expect(body.photo.height).toBe(1);

		// And it was persisted, not just computed for the response.
		const persisted = await env.DB.prepare(
			"SELECT width, height FROM exif_data WHERE photo_id = ?",
		)
			.bind(id)
			.first<{ width: number | null; height: number | null }>();
		expect(persisted?.width).toBe(1);
		expect(persisted?.height).toBe(1);
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
