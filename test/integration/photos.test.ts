import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface UploadResponse {
	ok: boolean;
	uploaded: { id: string; original_filename: string }[];
}

interface PhotoRow {
	id: string;
	original_filename: string;
	content_type: string;
	file_size: number;
}

async function upload(
	cookie: string,
	filename: string,
): Promise<UploadResponse> {
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
	return (await res.json()) as UploadResponse;
}

describe("photos", () => {
	it("rejects an upload with no image files", async () => {
		const cookie = await login();
		const form = new FormData();
		form.append("note", "just text, no image");
		const res = await SELF.fetch(url("/api/photos"), {
			method: "POST",
			headers: { cookie },
			body: form,
		});
		expect(res.status).toBe(400);
	});

	it("uploads, lists, and streams a photo's original bytes", async () => {
		const cookie = await login();
		const { ok, uploaded } = await upload(cookie, "sunset.png");
		expect(ok).toBe(true);
		expect(uploaded).toHaveLength(1);
		const id = uploaded[0].id;
		expect(uploaded[0].original_filename).toBe("sunset.png");

		// It shows up in the listing with its metadata.
		const listRes = await SELF.fetch(url("/api/photos"), {
			headers: { cookie },
		});
		expect(listRes.status).toBe(200);
		const { photos } = (await listRes.json()) as { photos: PhotoRow[] };
		const row = photos.find((p) => p.id === id);
		expect(row, "uploaded photo should appear in listing").toBeDefined();
		expect(row?.content_type).toBe("image/png");
		expect(row?.file_size).toBe(pngBytes().byteLength);

		// The raw endpoint streams back the exact bytes with the right content-type.
		const rawRes = await SELF.fetch(url(`/api/photos/${id}/raw`), {
			headers: { cookie },
		});
		expect(rawRes.status).toBe(200);
		expect(rawRes.headers.get("content-type")).toBe("image/png");
		const bytes = new Uint8Array(await rawRes.arrayBuffer());
		expect(bytes).toEqual(pngBytes());
	});

	it("returns 404 for an unknown photo id", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/photos/does-not-exist/raw"), {
			headers: { cookie },
		});
		expect(res.status).toBe(404);
	});

	it("serves a resized webp variant for a known size", async () => {
		const cookie = await login();
		const { uploaded } = await upload(cookie, "variant.png");
		const id = uploaded[0].id;

		const res = await SELF.fetch(url(`/api/photos/${id}/variant?size=thumb`), {
			headers: { cookie },
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("image/webp");
		expect(res.headers.get("cache-control")).toContain("max-age=31536000");
		const bytes = new Uint8Array(await res.arrayBuffer());
		expect(bytes.byteLength).toBeGreaterThan(0);
	});

	it("rejects an unknown variant size with 400", async () => {
		const cookie = await login();
		const { uploaded } = await upload(cookie, "badsize.png");
		const id = uploaded[0].id;

		const res = await SELF.fetch(url(`/api/photos/${id}/variant?size=huge`), {
			headers: { cookie },
		});
		expect(res.status).toBe(400);
	});

	it("returns 404 for a variant of an unknown photo id", async () => {
		const cookie = await login();
		const res = await SELF.fetch(
			url("/api/photos/does-not-exist/variant?size=md"),
			{ headers: { cookie } },
		);
		expect(res.status).toBe(404);
	});
});
