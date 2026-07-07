import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface UploadResponse {
	ok: boolean;
	uploaded: { id: string; original_filename: string }[];
}

interface Usage {
	count: number;
	originalBytes: number;
	variantBytes: number;
	variantBytesComplete: boolean;
	trashedCount: number;
	trashedBytes: number;
	totalBytes: number;
	tables: {
		photos: number;
		exif_data: number;
		folders: number;
		tags: number;
		folder_photos: number;
		photo_tags: number;
	};
	cost: {
		r2StorageUsdPerGbMonth: number;
		estimatedMonthlyUsd: number;
	};
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

async function getUsage(cookie: string): Promise<Usage> {
	const res = await SELF.fetch(url("/api/settings/usage"), {
		headers: { cookie },
	});
	expect(res.status, "usage should succeed").toBe(200);
	return (await res.json()) as Usage;
}

describe("GET /api/settings/usage", () => {
	it("reports live counts, bytes, and per-table row counts", async () => {
		const cookie = await login();
		const size = pngBytes().byteLength;

		const before = await getUsage(cookie);

		const a = await upload(cookie, `usage-a-${Date.now()}.png`);
		await upload(cookie, `usage-b-${Date.now()}.png`);

		const after = await getUsage(cookie);
		expect(after.count).toBe(before.count + 2);
		expect(after.originalBytes).toBe(before.originalBytes + 2 * size);
		// Variant bytes are tracked at generation time — the upload path records
		// them, so two live uploads add positive tracked variant bytes.
		expect(after.variantBytes).toBeGreaterThan(before.variantBytes);
		expect(after.totalBytes).toBeGreaterThanOrEqual(
			after.originalBytes + after.variantBytes,
		);
		// Per-table counts track the photos table growth.
		expect(after.tables.photos).toBe(before.tables.photos + 2);
		expect(typeof after.tables.exif_data).toBe("number");
		expect(typeof after.tables.folders).toBe("number");
		expect(typeof after.tables.tags).toBe("number");
		expect(typeof after.tables.folder_photos).toBe("number");
		expect(typeof after.tables.photo_tags).toBe("number");
		// Cost is a labeled static estimate.
		expect(after.cost.r2StorageUsdPerGbMonth).toBeGreaterThan(0);
		expect(after.cost.estimatedMonthlyUsd).toBeGreaterThanOrEqual(0);

		// Trashing a photo moves its original bytes into the reclaimable figure.
		const del = await SELF.fetch(url(`/api/photos/${a}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(del.status).toBe(200);

		const afterDelete = await getUsage(cookie);
		expect(afterDelete.count).toBe(after.count - 1);
		expect(afterDelete.trashedCount).toBe(before.trashedCount + 1);
		expect(afterDelete.trashedBytes).toBe(before.trashedBytes + size);
	});

	it("requires auth (401 without a session cookie)", async () => {
		const res = await SELF.fetch(url("/api/settings/usage"));
		expect(res.status).toBe(401);
	});
});
