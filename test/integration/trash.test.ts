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
}

interface ListResponse {
	photos: PhotoRow[];
	total: number;
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

async function list(cookie: string, query = ""): Promise<ListResponse> {
	const res = await SELF.fetch(url(`/api/photos${query}`), {
		headers: { cookie },
	});
	expect(res.status, "list should succeed").toBe(200);
	return (await res.json()) as ListResponse;
}

describe("trash: soft delete / restore / purge", () => {
	it("soft-deletes a photo: hidden from the live list, visible in ?deleted=1, bytes survive", async () => {
		const cookie = await login();
		const tok = `soft${Date.now()}`;
		const id = await upload(cookie, `${tok}.png`);

		// Live before delete.
		const before = await list(cookie, `?q=${tok}`);
		expect(before.total).toBe(1);

		// Soft delete returns { ok: true }.
		const del = await SELF.fetch(url(`/api/photos/${id}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(del.status).toBe(200);
		expect((await del.json()) as { ok: boolean }).toEqual({ ok: true });

		// Gone from the live listing…
		const live = await list(cookie, `?q=${tok}`);
		expect(live.total).toBe(0);
		expect(live.photos.find((p) => p.id === id)).toBeUndefined();

		// …but present in the Trash view.
		const trash = await list(cookie, `?q=${tok}&deleted=1`);
		expect(trash.total).toBe(1);
		expect(trash.photos[0].id).toBe(id);

		// Row still in D1 with a tombstone; bytes still streamable.
		const row = await env.DB.prepare(
			"SELECT deleted_at FROM photos WHERE id = ?",
		)
			.bind(id)
			.first<{ deleted_at: string | null }>();
		expect(row?.deleted_at).toBeTruthy();
		const raw = await SELF.fetch(url(`/api/photos/${id}/raw`), {
			headers: { cookie },
		});
		expect(raw.status).toBe(200);
	});

	it("excludes tombstones from the geo (map) view", async () => {
		const cookie = await login();
		const id = await upload(cookie, `geotrash-${Date.now()}.png`);
		await env.DB.prepare(
			"UPDATE exif_data SET gps_latitude = ?, gps_longitude = ? WHERE photo_id = ?",
		)
			.bind(1.23, 4.56, id)
			.run();

		// Present on the map while live.
		const geoBefore = (await (
			await SELF.fetch(url("/api/photos/geo"), { headers: { cookie } })
		).json()) as { photos: PhotoRow[] };
		expect(geoBefore.photos.find((p) => p.id === id)).toBeDefined();

		// Soft delete → drops off the map.
		await SELF.fetch(url(`/api/photos/${id}`), {
			method: "DELETE",
			headers: { cookie },
		});
		const geoAfter = (await (
			await SELF.fetch(url("/api/photos/geo"), { headers: { cookie } })
		).json()) as { photos: PhotoRow[] };
		expect(geoAfter.photos.find((p) => p.id === id)).toBeUndefined();
	});

	it("restores a tombstoned photo back to the live library", async () => {
		const cookie = await login();
		const tok = `rest${Date.now()}`;
		const id = await upload(cookie, `${tok}.png`);

		await SELF.fetch(url(`/api/photos/${id}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect((await list(cookie, `?q=${tok}`)).total).toBe(0);

		const restore = await SELF.fetch(url(`/api/photos/${id}/restore`), {
			method: "POST",
			headers: { cookie },
		});
		expect(restore.status).toBe(200);
		expect((await restore.json()) as { ok: boolean }).toEqual({ ok: true });

		// Back in the live list, gone from Trash.
		expect((await list(cookie, `?q=${tok}`)).total).toBe(1);
		expect((await list(cookie, `?q=${tok}&deleted=1`)).total).toBe(0);
	});

	it("returns 404 when restoring an unknown photo id", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/photos/does-not-exist/restore"), {
			method: "POST",
			headers: { cookie },
		});
		expect(res.status).toBe(404);
	});

	it("permanently purges a tombstoned photo (?purge=1): bytes + all D1 rows gone", async () => {
		const cookie = await login();
		const tok = `purge${Date.now()}`;
		const id = await upload(cookie, `${tok}.png`);

		// Give it a folder membership + a tag so there are child rows to clean up.
		const folderRes = await SELF.fetch(url("/api/folders"), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ name: `${tok}-folder`, parentFolderId: null }),
		});
		const folder = (await folderRes.json()) as { id: string };
		await SELF.fetch(url(`/api/folders/${folder.id}/photos`), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ photoIds: [id] }),
		});
		await SELF.fetch(url(`/api/photos/${id}/tags`), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ names: [`${tok}-tag`] }),
		});

		// Purge is refused while the photo is still live (not tombstoned).
		const early = await SELF.fetch(url(`/api/photos/${id}?purge=1`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(early.status).toBe(404);

		// Tombstone it, then purge for real.
		await SELF.fetch(url(`/api/photos/${id}`), {
			method: "DELETE",
			headers: { cookie },
		});
		const purge = await SELF.fetch(url(`/api/photos/${id}?purge=1`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(purge.status).toBe(200);
		expect((await purge.json()) as { ok: boolean }).toEqual({ ok: true });

		// No orphans anywhere.
		const photo = await env.DB.prepare("SELECT id FROM photos WHERE id = ?")
			.bind(id)
			.first();
		expect(photo).toBeNull();
		const exif = await env.DB.prepare(
			"SELECT photo_id FROM exif_data WHERE photo_id = ?",
		)
			.bind(id)
			.first();
		expect(exif).toBeNull();
		const fp = await env.DB.prepare(
			"SELECT photo_id FROM folder_photos WHERE photo_id = ?",
		)
			.bind(id)
			.first();
		expect(fp).toBeNull();
		const pt = await env.DB.prepare(
			"SELECT photo_id FROM photo_tags WHERE photo_id = ?",
		)
			.bind(id)
			.first();
		expect(pt).toBeNull();

		// Bytes gone: raw 404s.
		const raw = await SELF.fetch(url(`/api/photos/${id}/raw`), {
			headers: { cookie },
		});
		expect(raw.status).toBe(404);
	});

	it("empties the trash: purges every tombstoned photo, leaves live ones", async () => {
		const cookie = await login();
		const tok = `empty${Date.now()}`;
		const trashedA = await upload(cookie, `${tok}-a.png`);
		const trashedB = await upload(cookie, `${tok}-b.png`);
		const kept = await upload(cookie, `${tok}-live.png`);

		// Tombstone two of the three.
		for (const id of [trashedA, trashedB]) {
			await SELF.fetch(url(`/api/photos/${id}`), {
				method: "DELETE",
				headers: { cookie },
			});
		}

		const empty = await SELF.fetch(url("/api/photos/trash"), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(empty.status).toBe(200);
		const body = (await empty.json()) as { ok: boolean; purged: number };
		expect(body.ok).toBe(true);
		expect(body.purged).toBeGreaterThanOrEqual(2);

		// Trash is now empty, the live photo is untouched, and the purged rows are gone.
		expect((await list(cookie, `?q=${tok}&deleted=1`)).total).toBe(0);
		const live = await list(cookie, `?q=${tok}`);
		expect(live.total).toBe(1);
		expect(live.photos[0].id).toBe(kept);
		for (const id of [trashedA, trashedB]) {
			const gone = await env.DB.prepare("SELECT id FROM photos WHERE id = ?")
				.bind(id)
				.first();
			expect(gone).toBeNull();
		}
	});
});
