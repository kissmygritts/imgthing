import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface Facet {
	name: string;
	photo_count: number;
}

interface PhotoRow {
	id: string;
	original_filename: string;
	camera_model: string | null;
	lens_info: string | null;
}

async function upload(cookie: string, name: string): Promise<string> {
	const form = new FormData();
	form.append("file", new File([pngBytes()], name, { type: "image/png" }));
	const res = await SELF.fetch(url("/api/photos"), {
		method: "POST",
		headers: { cookie },
		body: form,
	});
	expect(res.status).toBe(200);
	const { uploaded } = (await res.json()) as { uploaded: { id: string }[] };
	return uploaded[0].id;
}

// A plain PNG carries no EXIF, so stamp the camera/lens directly on the row the
// upload created — mirroring a real image whose EXIF was parsed on ingest.
async function setExif(id: string, camera: string | null, lens: string | null) {
	await env.DB.prepare(
		"UPDATE exif_data SET camera_model = ?, lens_info = ? WHERE photo_id = ?",
	)
		.bind(camera, lens, id)
		.run();
}

async function listCameras(cookie: string): Promise<Facet[]> {
	const res = await SELF.fetch(url("/api/cameras"), { headers: { cookie } });
	expect(res.status).toBe(200);
	return ((await res.json()) as { cameras: Facet[] }).cameras;
}

async function listLenses(cookie: string): Promise<Facet[]> {
	const res = await SELF.fetch(url("/api/lenses"), { headers: { cookie } });
	expect(res.status).toBe(200);
	return ((await res.json()) as { lenses: Facet[] }).lenses;
}

async function listPhotos(cookie: string, query = ""): Promise<PhotoRow[]> {
	const res = await SELF.fetch(url(`/api/photos${query}`), {
		headers: { cookie },
	});
	expect(res.status).toBe(200);
	return ((await res.json()) as { photos: PhotoRow[] }).photos;
}

describe("cameras & lenses", () => {
	it("aggregates cameras and lenses with live-photo counts", async () => {
		const cookie = await login();
		const tok = `cam${Date.now()}`;
		const camA = `Canon-${tok}`;
		const camB = `Nikon-${tok}`;
		const lensA = `RF50-${tok}`;
		const lensB = `RF2470-${tok}`;

		// Two on camA (one lensA, one lensB), one on camB (lensA).
		const p1 = await upload(cookie, `${tok}-1.png`);
		const p2 = await upload(cookie, `${tok}-2.png`);
		const p3 = await upload(cookie, `${tok}-3.png`);
		await setExif(p1, camA, lensA);
		await setExif(p2, camA, lensB);
		await setExif(p3, camB, lensA);

		const cameras = await listCameras(cookie);
		expect(cameras.find((c) => c.name === camA)?.photo_count).toBe(2);
		expect(cameras.find((c) => c.name === camB)?.photo_count).toBe(1);

		const lenses = await listLenses(cookie);
		expect(lenses.find((l) => l.name === lensA)?.photo_count).toBe(2);
		expect(lenses.find((l) => l.name === lensB)?.photo_count).toBe(1);
	});

	it("excludes tombstoned (trashed) photos from the counts", async () => {
		const cookie = await login();
		const tok = `trash${Date.now()}`;
		const cam = `Sony-${tok}`;
		const lens = `FE85-${tok}`;
		const keep = await upload(cookie, `${tok}-keep.png`);
		const trash = await upload(cookie, `${tok}-trash.png`);
		await setExif(keep, cam, lens);
		await setExif(trash, cam, lens);

		expect(
			(await listCameras(cookie)).find((c) => c.name === cam)?.photo_count,
		).toBe(2);

		// Soft-delete one — it should drop out of both aggregations.
		const del = await SELF.fetch(url(`/api/photos/${trash}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(del.status).toBe(200);

		expect(
			(await listCameras(cookie)).find((c) => c.name === cam)?.photo_count,
		).toBe(1);
		expect(
			(await listLenses(cookie)).find((l) => l.name === lens)?.photo_count,
		).toBe(1);
	});

	it("filters the gallery by camera, by lens, and by the two combined", async () => {
		const cookie = await login();
		const tok = `flt${Date.now()}`;
		const camA = `CanonF-${tok}`;
		const camB = `NikonF-${tok}`;
		const lensA = `L50-${tok}`;
		const lensB = `L24-${tok}`;

		const p1 = await upload(cookie, `${tok}-1.png`); // camA + lensA
		const p2 = await upload(cookie, `${tok}-2.png`); // camA + lensB
		const p3 = await upload(cookie, `${tok}-3.png`); // camB + lensA
		await setExif(p1, camA, lensA);
		await setExif(p2, camA, lensB);
		await setExif(p3, camB, lensA);

		// By camera: p1 + p2.
		const byCam = await listPhotos(
			cookie,
			`?camera=${encodeURIComponent(camA)}`,
		);
		const camIds = byCam.map((p) => p.id);
		expect(camIds).toContain(p1);
		expect(camIds).toContain(p2);
		expect(camIds).not.toContain(p3);

		// By lens: p1 + p3.
		const byLens = await listPhotos(
			cookie,
			`?lens=${encodeURIComponent(lensA)}`,
		);
		const lensIds = byLens.map((p) => p.id);
		expect(lensIds).toContain(p1);
		expect(lensIds).toContain(p3);
		expect(lensIds).not.toContain(p2);

		// Combined (camA AND lensA): only p1.
		const both = await listPhotos(
			cookie,
			`?camera=${encodeURIComponent(camA)}&lens=${encodeURIComponent(lensA)}`,
		);
		const bothIds = both.map((p) => p.id);
		expect(bothIds).toContain(p1);
		expect(bothIds).not.toContain(p2);
		expect(bothIds).not.toContain(p3);
	});

	it("guards the cameras aggregation behind auth (401)", async () => {
		const res = await SELF.fetch(url("/api/cameras"));
		expect(res.status).toBe(401);
	});

	it("guards the lenses aggregation behind auth (401)", async () => {
		const res = await SELF.fetch(url("/api/lenses"));
		expect(res.status).toBe(401);
	});
});
