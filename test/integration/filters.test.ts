import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface PhotoRow {
	id: string;
	original_filename: string;
	is_favorite: number;
	visibility: string;
	camera_model: string | null;
	tag_ids: string | null;
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

async function setExif(id: string, camera: string | null) {
	await env.DB.prepare(
		"UPDATE exif_data SET camera_model = ? WHERE photo_id = ?",
	)
		.bind(camera, id)
		.run();
}

async function setTakenAt(id: string, takenAt: string | null) {
	await env.DB.prepare("UPDATE exif_data SET taken_at = ? WHERE photo_id = ?")
		.bind(takenAt, id)
		.run();
}

async function createTag(cookie: string, name: string): Promise<string> {
	const res = await SELF.fetch(url("/api/tags"), {
		method: "POST",
		headers: { cookie, "content-type": "application/json" },
		body: JSON.stringify({ name }),
	});
	expect(res.status).toBe(200);
	return ((await res.json()) as { id: string }).id;
}

async function attachTag(cookie: string, photoId: string, tagId: string) {
	const res = await SELF.fetch(url(`/api/photos/${photoId}/tags`), {
		method: "POST",
		headers: { cookie, "content-type": "application/json" },
		body: JSON.stringify({ tagIds: [tagId] }),
	});
	expect(res.status).toBe(200);
}

async function favorite(cookie: string, photoId: string) {
	const res = await SELF.fetch(url(`/api/photos/${photoId}/favorite`), {
		method: "POST",
		headers: { cookie },
	});
	expect(res.status).toBe(200);
}

async function publish(cookie: string, photoId: string) {
	const res = await SELF.fetch(url(`/api/photos/${photoId}/publish`), {
		method: "POST",
		headers: { cookie, "content-type": "application/json" },
		body: JSON.stringify({ showLocation: false }),
	});
	expect(res.status).toBe(200);
}

async function listPhotos(cookie: string, query = ""): Promise<PhotoRow[]> {
	const res = await SELF.fetch(url(`/api/photos${query}`), {
		headers: { cookie },
	});
	expect(res.status).toBe(200);
	return ((await res.json()) as { photos: PhotoRow[] }).photos;
}

describe("composable filters", () => {
	it("matches photos carrying ANY of a list of tag ids (?tags, OR'd)", async () => {
		const cookie = await login();
		const tok = `mt${Date.now()}`;
		const tagA = await createTag(cookie, `${tok}-a`);
		const tagB = await createTag(cookie, `${tok}-b`);
		const pA = await upload(cookie, `${tok}-a.png`);
		const pB = await upload(cookie, `${tok}-b.png`);
		const pNone = await upload(cookie, `${tok}-none.png`);
		await attachTag(cookie, pA, tagA);
		await attachTag(cookie, pB, tagB);

		const rows = await listPhotos(cookie, `?tags=${tagA},${tagB}`);
		const ids = rows.map((p) => p.id);
		expect(ids).toContain(pA);
		expect(ids).toContain(pB);
		expect(ids).not.toContain(pNone);
	});

	it("filters by visibility (public / private), leaving it unconstrained when omitted", async () => {
		const cookie = await login();
		const tok = `vis${Date.now()}`;
		const pub = await upload(cookie, `${tok}-pub.png`);
		const priv = await upload(cookie, `${tok}-priv.png`);
		await publish(cookie, pub);

		const pubOnly = await listPhotos(cookie, `?q=${tok}&visibility=public`);
		expect(pubOnly.map((p) => p.id)).toEqual([pub]);

		const privOnly = await listPhotos(cookie, `?q=${tok}&visibility=private`);
		expect(privOnly.map((p) => p.id)).toEqual([priv]);

		const anyVisibility = await listPhotos(cookie, `?q=${tok}`);
		const anyIds = anyVisibility.map((p) => p.id);
		expect(anyIds).toContain(pub);
		expect(anyIds).toContain(priv);
	});

	it("private-visibility filter matches everything in Trash (trashed photos are always private)", async () => {
		const cookie = await login();
		const tok = `trvis${Date.now()}`;
		const photoId = await upload(cookie, `${tok}.png`);
		await publish(cookie, photoId);
		const del = await SELF.fetch(url(`/api/photos/${photoId}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(del.status).toBe(200);

		// Publishing before trashing, then trashing, clears visibility — a
		// public-only filter inside Trash correctly yields nothing.
		const pubInTrash = await listPhotos(
			cookie,
			`?q=${tok}&deleted=1&visibility=public`,
		);
		expect(pubInTrash.map((p) => p.id)).not.toContain(photoId);

		const privInTrash = await listPhotos(
			cookie,
			`?q=${tok}&deleted=1&visibility=private`,
		);
		expect(privInTrash.map((p) => p.id)).toContain(photoId);
	});

	it("composes tag + favorite + camera + date range together (full AND)", async () => {
		const cookie = await login();
		const tok = `and${Date.now()}`;
		const tag = await createTag(cookie, `${tok}-tag`);
		const camera = `Camera-${tok}`;

		// Matches every facet.
		const match = await upload(cookie, `${tok}-match.png`);
		await attachTag(cookie, match, tag);
		await favorite(cookie, match);
		await setExif(match, camera);
		await setTakenAt(match, "2005-06-15T10:00:00Z");

		// Fails just the camera facet — otherwise identical.
		const wrongCamera = await upload(cookie, `${tok}-wrong-camera.png`);
		await attachTag(cookie, wrongCamera, tag);
		await favorite(cookie, wrongCamera);
		await setExif(wrongCamera, `Other-${tok}`);
		await setTakenAt(wrongCamera, "2005-06-15T10:00:00Z");

		// Fails just the favorite facet.
		const notFavorited = await upload(cookie, `${tok}-not-fav.png`);
		await attachTag(cookie, notFavorited, tag);
		await setExif(notFavorited, camera);
		await setTakenAt(notFavorited, "2005-06-15T10:00:00Z");

		// Fails just the date-range facet.
		const outsideRange = await upload(cookie, `${tok}-outside-range.png`);
		await attachTag(cookie, outsideRange, tag);
		await favorite(cookie, outsideRange);
		await setExif(outsideRange, camera);
		await setTakenAt(outsideRange, "1999-01-01T10:00:00Z");

		const rows = await listPhotos(
			cookie,
			`?tags=${tag}&favorite=1&camera=${encodeURIComponent(camera)}&dateFrom=2005-01-01&dateTo=2005-12-31`,
		);
		const ids = rows.map((p) => p.id);
		expect(ids).toContain(match);
		expect(ids).not.toContain(wrongCamera);
		expect(ids).not.toContain(notFavorited);
		expect(ids).not.toContain(outsideRange);
	});
});
