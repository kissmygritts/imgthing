import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface Month {
	month: string;
	count: number;
	thumbs: string[];
}

// Storage is shared across the tests in this file (pool-workers resets per file,
// not per `it`), so each test uses its own distinct year to stay independent and
// asserts against its month via `find` rather than assuming a clean library.

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
// created — mirroring a real image whose capture date was parsed on ingest. This
// lets a test place a photo in a specific capture month.
async function setTakenAt(id: string, takenAt: string) {
	await env.DB.prepare("UPDATE exif_data SET taken_at = ? WHERE photo_id = ?")
		.bind(takenAt, id)
		.run();
}

async function months(cookie: string): Promise<Month[]> {
	const res = await SELF.fetch(url("/api/photos/months"), {
		headers: { cookie },
	});
	expect(res.status).toBe(200);
	return ((await res.json()) as { months: Month[] }).months;
}

describe("GET /api/photos/months", () => {
	it("groups live photos by capture month, newest month first, with counts", async () => {
		const cookie = await login();
		// Two in July 2019, one in December 2018 — distinct year for isolation.
		const jul1 = await upload(cookie, "jul1.png");
		const jul2 = await upload(cookie, "jul2.png");
		const dec = await upload(cookie, "dec.png");
		await setTakenAt(jul1, "2019-07-10T09:00:00");
		await setTakenAt(jul2, "2019-07-20T18:30:00");
		await setTakenAt(dec, "2018-12-24T23:00:00");

		const all = await months(cookie);
		expect(all.find((m) => m.month === "2019-07")?.count).toBe(2);
		expect(all.find((m) => m.month === "2018-12")?.count).toBe(1);
		// Newest month first: 2019-07 comes before 2018-12 in the list.
		const mine = all
			.map((m) => m.month)
			.filter((m) => m === "2019-07" || m === "2018-12");
		expect(mine).toEqual(["2019-07", "2018-12"]);
	});

	it("returns the newest-first photo ids for the thumb strip", async () => {
		const cookie = await login();
		const older = await upload(cookie, "older.png");
		const newer = await upload(cookie, "newer.png");
		await setTakenAt(older, "2020-03-05T08:00:00");
		await setTakenAt(newer, "2020-03-28T08:00:00");

		const march = (await months(cookie)).find((m) => m.month === "2020-03");
		// Newest capture date first.
		expect(march?.thumbs).toEqual([newer, older]);
	});

	it("caps the thumb strip at six ids but keeps the full count", async () => {
		const cookie = await login();
		for (let i = 0; i < 7; i++) {
			const id = await upload(cookie, `cap-${i}.png`);
			// Day 01..07 so ordering is deterministic; newest (day 07) is first.
			await setTakenAt(id, `2021-02-0${i + 1}T12:00:00`);
		}
		const feb = (await months(cookie)).find((m) => m.month === "2021-02");
		expect(feb?.count).toBe(7);
		expect(feb?.thumbs).toHaveLength(6);
	});

	it("excludes tombstoned (trashed) photos from counts and thumbs", async () => {
		const cookie = await login();
		const keep = await upload(cookie, "keep.png");
		const trash = await upload(cookie, "trash.png");
		await setTakenAt(keep, "2022-06-10T10:00:00");
		await setTakenAt(trash, "2022-06-11T10:00:00");

		const del = await SELF.fetch(url(`/api/photos/${trash}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(del.status).toBe(200);

		const june = (await months(cookie)).find((m) => m.month === "2022-06");
		expect(june?.count).toBe(1);
		expect(june?.thumbs).toEqual([keep]);
	});

	it("returns an empty array when the library has no photos", async () => {
		const cookie = await login();
		// Clear any rows other tests left so "no live photos" is unambiguous.
		await env.DB.prepare("DELETE FROM photos").run();
		expect(await months(cookie)).toEqual([]);
	});

	it("guards the endpoint behind auth (401)", async () => {
		const res = await SELF.fetch(url("/api/photos/months"));
		expect(res.status).toBe(401);
	});
});
