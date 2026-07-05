import { env, SELF } from "cloudflare:test";
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
	is_favorite: number;
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

async function createFolder(cookie: string, name: string): Promise<string> {
	const res = await SELF.fetch(url("/api/folders"), {
		method: "POST",
		headers: { cookie, "content-type": "application/json" },
		body: JSON.stringify({ name, parentFolderId: null }),
	});
	expect(res.status, "create folder should succeed").toBe(200);
	return ((await res.json()) as { id: string }).id;
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

	it("assigns uploads to a folder when folderId is provided", async () => {
		const cookie = await login();
		const folderId = await createFolder(cookie, `upload-target-${Date.now()}`);

		// Upload two files straight into the folder via the multipart folderId field.
		const png = pngBytes();
		const form = new FormData();
		form.append("files", new File([png], "in-a.png", { type: "image/png" }));
		form.append("files", new File([png], "in-b.png", { type: "image/png" }));
		form.append("folderId", folderId);
		const res = await SELF.fetch(url("/api/photos"), {
			method: "POST",
			headers: { cookie },
			body: form,
		});
		expect(res.status).toBe(200);
		const { uploaded } = (await res.json()) as UploadResponse;
		expect(uploaded).toHaveLength(2);
		const ids = new Set(uploaded.map((u) => u.id));

		// Both show up when the listing is filtered to that folder.
		const inFolder = await list(cookie, `?folderId=${folderId}`);
		const found = inFolder.photos.filter((p) => ids.has(p.id));
		expect(found).toHaveLength(2);
	});

	it("rejects an upload targeting a nonexistent folder with 404", async () => {
		const cookie = await login();
		const png = pngBytes();
		const form = new FormData();
		form.append("files", new File([png], "orphan.png", { type: "image/png" }));
		form.append("folderId", "does-not-exist");
		const res = await SELF.fetch(url("/api/photos"), {
			method: "POST",
			headers: { cookie },
			body: form,
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

	it("soft-deletes then purges a photo, dropping its bytes and all D1 rows", async () => {
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

		// A plain DELETE is now a soft delete (move to Trash).
		const delRes = await SELF.fetch(url(`/api/photos/${id}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(delRes.status).toBe(200);
		expect((await delRes.json()) as { ok: boolean }).toEqual({ ok: true });

		// Gone from the normal listing…
		const listRes = await SELF.fetch(url("/api/photos"), {
			headers: { cookie },
		});
		const { photos } = (await listRes.json()) as { photos: PhotoRow[] };
		expect(photos.find((p) => p.id === id)).toBeUndefined();

		// …but the bytes survive until purge.
		const stillThere = await SELF.fetch(url(`/api/photos/${id}/raw`), {
			headers: { cookie },
		});
		expect(stillThere.status).toBe(200);

		// Permanent purge drops the R2 object + all D1 rows.
		const purgeRes = await SELF.fetch(url(`/api/photos/${id}?purge=1`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(purgeRes.status).toBe(200);
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

describe("photos: upload limits", () => {
	it("rejects an over-size file with a 413 naming the file and limit", async () => {
		const cookie = await login();
		// 26 MB > the 25 MB per-file ceiling. Valid PNG bytes + padding after IEND.
		const png = pngBytes();
		const big = new Uint8Array([...png, ...new Uint8Array(26 * 1024 * 1024)]);
		const form = new FormData();
		form.append("files", new File([big], "huge.png", { type: "image/png" }));
		const res = await SELF.fetch(url("/api/photos"), {
			method: "POST",
			headers: { cookie },
			body: form,
		});
		expect(res.status).toBe(413);
		const body = (await res.json()) as { statusMessage?: string };
		expect(body.statusMessage).toContain("huge.png");
		expect(body.statusMessage).toContain("25 MB");
	});

	it("keeps valid files and reports over-size ones in a mixed batch", async () => {
		const cookie = await login();
		const png = pngBytes();
		const big = new Uint8Array([...png, ...new Uint8Array(26 * 1024 * 1024)]);
		const form = new FormData();
		form.append("files", new File([png], "ok.png", { type: "image/png" }));
		form.append("files", new File([big], "toobig.png", { type: "image/png" }));
		const res = await SELF.fetch(url("/api/photos"), {
			method: "POST",
			headers: { cookie },
			body: form,
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			uploaded: { original_filename: string }[];
			rejected: { filename: string; reason: string }[];
		};
		expect(body.uploaded).toHaveLength(1);
		expect(body.uploaded[0].original_filename).toBe("ok.png");
		expect(body.rejected).toHaveLength(1);
		expect(body.rejected[0].filename).toBe("toobig.png");
	});

	it("rejects a request with too many files (over the count cap) with 413", async () => {
		const cookie = await login();
		const png = pngBytes();
		const form = new FormData();
		// 51 tiny parts — the count guard should fire before any EXIF/R2 work.
		for (let i = 0; i < 51; i++) {
			form.append("files", new File([png], `n${i}.png`, { type: "image/png" }));
		}
		const res = await SELF.fetch(url("/api/photos"), {
			method: "POST",
			headers: { cookie },
			body: form,
		});
		expect(res.status).toBe(413);
		const body = (await res.json()) as { statusMessage?: string };
		expect(body.statusMessage).toContain("50");
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

	it("toggles the favorite flag and filters via ?favorite=1", async () => {
		const cookie = await login();
		const tok = `ftok${Date.now()}`;
		const { uploaded } = await upload(cookie, `${tok}-fav.png`);
		await upload(cookie, `${tok}-plain.png`);
		const id = uploaded[0].id;

		// Freshly uploaded photos are not favorited.
		const before = await list(cookie, `?q=${tok}`);
		expect(before.total).toBe(2);
		expect(before.photos.every((p) => p.is_favorite === 0)).toBe(true);

		// Toggle on → returns the new state.
		const on = await SELF.fetch(url(`/api/photos/${id}/favorite`), {
			method: "POST",
			headers: { cookie },
		});
		expect(on.status).toBe(200);
		expect((await on.json()) as { id: string; is_favorite: number }).toEqual({
			id,
			is_favorite: 1,
		});

		// ?favorite=1 now returns only the hearted photo.
		const favs = await list(cookie, `?q=${tok}&favorite=1`);
		expect(favs.total).toBe(1);
		expect(favs.photos[0].id).toBe(id);
		expect(favs.photos[0].is_favorite).toBe(1);

		// Toggle off → back to 0 and out of the favorites filter.
		const off = await SELF.fetch(url(`/api/photos/${id}/favorite`), {
			method: "POST",
			headers: { cookie },
		});
		expect(off.status).toBe(200);
		expect((await off.json()) as { is_favorite: number }).toMatchObject({
			is_favorite: 0,
		});
		const favsAfter = await list(cookie, `?q=${tok}&favorite=1`);
		expect(favsAfter.total).toBe(0);
	});

	it("returns 404 when favoriting an unknown photo id", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/photos/does-not-exist/favorite"), {
			method: "POST",
			headers: { cookie },
		});
		expect(res.status).toBe(404);
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

interface GeoRow extends PhotoRow {
	gps_latitude: number | null;
	gps_longitude: number | null;
}

describe("photos: geo (map view)", () => {
	it("returns only geotagged photos with their coordinates", async () => {
		const cookie = await login();
		// The 1x1 test PNG carries no EXIF GPS, so seed coordinates directly on the
		// exif_data row the upload created — mirroring a real geotagged image.
		const geo = await upload(cookie, `geo-${Date.now()}.png`);
		const plain = await upload(cookie, `plain-${Date.now()}.png`);
		const geoId = geo.uploaded[0].id;
		const plainId = plain.uploaded[0].id;

		const lat = 37.8199;
		const lng = -122.4783;
		await env.DB.prepare(
			"UPDATE exif_data SET gps_latitude = ?, gps_longitude = ? WHERE photo_id = ?",
		)
			.bind(lat, lng, geoId)
			.run();

		const res = await SELF.fetch(url("/api/photos/geo"), {
			headers: { cookie },
		});
		expect(res.status).toBe(200);
		const { photos } = (await res.json()) as { photos: GeoRow[] };

		const row = photos.find((p) => p.id === geoId);
		expect(row, "geotagged photo should appear").toBeDefined();
		expect(row?.gps_latitude).toBeCloseTo(lat, 4);
		expect(row?.gps_longitude).toBeCloseTo(lng, 4);

		// The un-geotagged upload is excluded, and every returned row has coords.
		expect(photos.find((p) => p.id === plainId)).toBeUndefined();
		expect(
			photos.every((p) => p.gps_latitude != null && p.gps_longitude != null),
		).toBe(true);
	});

	it("requires authentication", async () => {
		const res = await SELF.fetch(url("/api/photos/geo"));
		expect(res.status).toBe(401);
	});
});
