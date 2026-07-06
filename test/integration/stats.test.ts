import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface UploadResponse {
	ok: boolean;
	uploaded: { id: string; original_filename: string }[];
}

interface Stats {
	count: number;
	totalBytes: number;
	trashedCount: number;
	trashedBytes: number;
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

async function getStats(cookie: string): Promise<Stats> {
	const res = await SELF.fetch(url("/api/photos/stats"), {
		headers: { cookie },
	});
	expect(res.status, "stats should succeed").toBe(200);
	return (await res.json()) as Stats;
}

describe("GET /api/photos/stats", () => {
	it("aggregates live count + summed bytes, excluding trash", async () => {
		const cookie = await login();
		const size = pngBytes().byteLength;

		const before = await getStats(cookie);

		// Three live uploads bump count by 3 and totalBytes by 3 * size.
		const a = await upload(cookie, `stats-a-${Date.now()}.png`);
		await upload(cookie, `stats-b-${Date.now()}.png`);
		await upload(cookie, `stats-c-${Date.now()}.png`);

		const afterUpload = await getStats(cookie);
		expect(afterUpload.count).toBe(before.count + 3);
		expect(afterUpload.totalBytes).toBe(before.totalBytes + 3 * size);

		// Tombstone one: it leaves the live figure and shows up in the trashed one.
		const del = await SELF.fetch(url(`/api/photos/${a}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(del.status).toBe(200);

		const afterDelete = await getStats(cookie);
		expect(afterDelete.count).toBe(before.count + 2);
		expect(afterDelete.totalBytes).toBe(before.totalBytes + 2 * size);
		expect(afterDelete.trashedCount).toBe(before.trashedCount + 1);
		expect(afterDelete.trashedBytes).toBe(before.trashedBytes + size);
	});

	it("requires auth (401 without a session cookie)", async () => {
		const res = await SELF.fetch(url("/api/photos/stats"));
		expect(res.status).toBe(401);
	});
});
