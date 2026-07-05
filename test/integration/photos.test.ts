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

interface ListResponse {
	photos: PhotoRow[];
	total: number;
	limit: number;
	offset: number;
}

async function list(cookie: string, query = ""): Promise<ListResponse> {
	const res = await SELF.fetch(url(`/api/photos${query}`), {
		headers: { cookie },
	});
	expect(res.status, "list should succeed").toBe(200);
	return (await res.json()) as ListResponse;
}

async function upload(
	cookie: string,
	filename: string,
	// Optional trailing padding so tests can control file_size independently of
	// the tiny 1x1 PNG. Padding after IEND keeps the bytes a valid image/png.
	pad = 0,
): Promise<UploadResponse> {
	const png = pngBytes();
	const body = pad > 0 ? new Uint8Array([...png, ...new Uint8Array(pad)]) : png;
	const form = new FormData();
	form.append(
		"file",
		new File([body], filename, { type: "image/png" }),
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

	it("deletes a photo, its bytes, and all D1 rows", async () => {
		const cookie = await login();
		const { uploaded } = await upload(cookie, "trash-me.png");
		const id = uploaded[0].id;

		// Put it in a folder so a folder_photos membership exists to clean up.
		const folderRes = await SELF.fetch(url("/api/folders"), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ name: "delete-test", parentFolderId: null }),
		});
		expect(folderRes.status).toBe(200);
		const folder = (await folderRes.json()) as { id: string };
		const memberRes = await SELF.fetch(
			url(`/api/folders/${folder.id}/photos`),
			{
				method: "POST",
				headers: { cookie, "content-type": "application/json" },
				body: JSON.stringify({ photoIds: [id] }),
			},
		);
		expect(memberRes.status).toBe(200);

		// Delete succeeds.
		const delRes = await SELF.fetch(url(`/api/photos/${id}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(delRes.status).toBe(200);
		expect((await delRes.json()) as { ok: boolean }).toEqual({ ok: true });

		// Gone from the listing.
		const listRes = await SELF.fetch(url("/api/photos"), {
			headers: { cookie },
		});
		const { photos } = (await listRes.json()) as { photos: PhotoRow[] };
		expect(photos.find((p) => p.id === id)).toBeUndefined();

		// Bytes gone: raw now 404s.
		const rawRes = await SELF.fetch(url(`/api/photos/${id}/raw`), {
			headers: { cookie },
		});
		expect(rawRes.status).toBe(404);
	});

	it("returns 404 when deleting an unknown photo id", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/photos/does-not-exist"), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(res.status).toBe(404);
	});
});

describe("photos: search / sort / range / paging", () => {
	it("filters by filename via ?q (case-insensitive substring)", async () => {
		const cookie = await login();
		// Unique token so this test is isolated from other rows in the shared DB.
		const tok = `qtok${Date.now()}`;
		await upload(cookie, `${tok}-Alpha.png`);
		await upload(cookie, `${tok}-Beta.png`);
		await upload(cookie, "unrelated-Gamma.png");

		const res = await list(cookie, `?q=${tok}`);
		expect(res.total).toBe(2);
		expect(res.photos).toHaveLength(2);
		expect(res.photos.every((p) => p.original_filename.startsWith(tok))).toBe(
			true,
		);

		// Case-insensitive: uppercasing the token still matches.
		const upper = await list(cookie, `?q=${tok.toUpperCase()}-ALPHA`);
		expect(upper.total).toBe(1);
	});

	it("sorts by name and reverses newest<->oldest server-side", async () => {
		const cookie = await login();
		const tok = `stok${Date.now()}`;
		await upload(cookie, `${tok}-c.png`);
		await upload(cookie, `${tok}-a.png`);
		await upload(cookie, `${tok}-b.png`);

		const byName = await list(cookie, `?q=${tok}&sort=name`);
		expect(byName.photos.map((p) => p.original_filename)).toEqual([
			`${tok}-a.png`,
			`${tok}-b.png`,
			`${tok}-c.png`,
		]);

		// newest is always the exact reverse of oldest for the same result set.
		const newest = await list(cookie, `?q=${tok}&sort=newest`);
		const oldest = await list(cookie, `?q=${tok}&sort=oldest`);
		expect(newest.photos.map((p) => p.id)).toEqual(
			oldest.photos.map((p) => p.id).reverse(),
		);
	});

	it("sorts by file size in both directions server-side", async () => {
		const cookie = await login();
		const tok = `ztok${Date.now()}`;
		// Same base PNG, distinct paddings → strictly increasing file_size.
		await upload(cookie, `${tok}-mid.png`, 100);
		await upload(cookie, `${tok}-big.png`, 500);
		await upload(cookie, `${tok}-small.png`, 0);

		const desc = await list(cookie, `?q=${tok}&sort=size_desc`);
		expect(desc.photos.map((p) => p.original_filename)).toEqual([
			`${tok}-big.png`,
			`${tok}-mid.png`,
			`${tok}-small.png`,
		]);
		// file_size is monotonically non-increasing for size_desc.
		const sizes = desc.photos.map((p) => p.file_size);
		expect(sizes).toEqual([...sizes].sort((a, b) => b - a));

		const asc = await list(cookie, `?q=${tok}&sort=size_asc`);
		expect(asc.photos.map((p) => p.id)).toEqual(
			desc.photos.map((p) => p.id).reverse(),
		);
	});

	it("filters by taken_at/uploaded_at date range via ?from/?to", async () => {
		const cookie = await login();
		const tok = `rtok${Date.now()}`;
		await upload(cookie, `${tok}-one.png`);
		await upload(cookie, `${tok}-two.png`);

		// Wide-open past bound includes today's uploads.
		const included = await list(cookie, `?q=${tok}&from=2000-01-01`);
		expect(included.total).toBe(2);

		// An upper bound before today excludes them.
		const excludedTo = await list(cookie, `?q=${tok}&to=2000-01-02`);
		expect(excludedTo.total).toBe(0);

		// A future lower bound excludes them.
		const excludedFrom = await list(cookie, `?q=${tok}&from=2999-01-01`);
		expect(excludedFrom.total).toBe(0);
	});

	it("pages with limit/offset and reports the full total", async () => {
		const cookie = await login();
		const tok = `ptok${Date.now()}`;
		await upload(cookie, `${tok}-1.png`);
		await upload(cookie, `${tok}-2.png`);
		await upload(cookie, `${tok}-3.png`);

		const page1 = await list(cookie, `?q=${tok}&sort=name&limit=2&offset=0`);
		expect(page1.total).toBe(3);
		expect(page1.photos).toHaveLength(2);
		expect(page1.photos.map((p) => p.original_filename)).toEqual([
			`${tok}-1.png`,
			`${tok}-2.png`,
		]);

		const page2 = await list(cookie, `?q=${tok}&sort=name&limit=2&offset=2`);
		expect(page2.total).toBe(3);
		expect(page2.photos).toHaveLength(1);
		expect(page2.photos[0].original_filename).toBe(`${tok}-3.png`);

		// No overlap between pages.
		const ids = new Set(page1.photos.map((p) => p.id));
		expect(ids.has(page2.photos[0].id)).toBe(false);
	});
});
