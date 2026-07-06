import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface PhotoRow {
	id: string;
	original_filename: string;
	taken_at: string | null;
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

// A plain PNG carries no EXIF, so stamp taken_at directly on the row the upload
// created — mirroring a real image whose capture time was parsed on ingest.
async function setTakenAt(id: string, takenAt: string | null) {
	await env.DB.prepare("UPDATE exif_data SET taken_at = ? WHERE photo_id = ?")
		.bind(takenAt, id)
		.run();
}

async function listPhotos(cookie: string, query = ""): Promise<PhotoRow[]> {
	const res = await SELF.fetch(url(`/api/photos${query}`), {
		headers: { cookie },
	});
	expect(res.status).toBe(200);
	return ((await res.json()) as { photos: PhotoRow[] }).photos;
}

describe("date-taken filter", () => {
	it("filters the gallery to a bounded range (end date inclusive)", async () => {
		const cookie = await login();
		const tok = `dt${Date.now()}`;
		// Use a distinct year so these rows can't collide with other tests' dates.
		const before = await upload(cookie, `${tok}-before.png`);
		const inMid = await upload(cookie, `${tok}-mid.png`);
		const inEndDay = await upload(cookie, `${tok}-endday.png`);
		const after = await upload(cookie, `${tok}-after.png`);
		await setTakenAt(before, "2001-03-10T09:00:00Z");
		await setTakenAt(inMid, "2001-06-20T12:00:00Z");
		// Late on the very last day of the range — proves date() makes the end inclusive.
		await setTakenAt(inEndDay, "2001-07-31T23:30:00Z");
		await setTakenAt(after, "2001-09-05T08:00:00Z");

		const rows = await listPhotos(
			cookie,
			"?dateFrom=2001-05-01&dateTo=2001-07-31",
		);
		const ids = rows.map((p) => p.id);
		expect(ids).toContain(inMid);
		expect(ids).toContain(inEndDay);
		expect(ids).not.toContain(before);
		expect(ids).not.toContain(after);
	});

	it("supports an open-ended range (only dateFrom)", async () => {
		const cookie = await login();
		const tok = `dto${Date.now()}`;
		const early = await upload(cookie, `${tok}-early.png`);
		const late = await upload(cookie, `${tok}-late.png`);
		await setTakenAt(early, "2002-02-01T10:00:00Z");
		await setTakenAt(late, "2002-11-15T10:00:00Z");

		const rows = await listPhotos(cookie, "?dateFrom=2002-06-01");
		const ids = rows.map((p) => p.id);
		expect(ids).toContain(late);
		expect(ids).not.toContain(early);
	});

	it("excludes undated (taken_at IS NULL) photos from a bounded range", async () => {
		const cookie = await login();
		const tok = `dtn${Date.now()}`;
		const dated = await upload(cookie, `${tok}-dated.png`);
		const undated = await upload(cookie, `${tok}-undated.png`);
		await setTakenAt(dated, "2003-04-10T10:00:00Z");
		await setTakenAt(undated, null);

		const rows = await listPhotos(
			cookie,
			"?dateFrom=2003-01-01&dateTo=2003-12-31",
		);
		const ids = rows.map((p) => p.id);
		expect(ids).toContain(dated);
		expect(ids).not.toContain(undated);
	});
});
