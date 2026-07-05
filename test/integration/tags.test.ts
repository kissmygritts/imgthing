import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface Tag {
	id: string;
	name: string;
	photo_count: number;
}

interface PhotoRow {
	id: string;
	original_filename: string;
	tag_ids: string | null;
}

async function createTag(cookie: string, name: string): Promise<Tag> {
	const res = await SELF.fetch(url("/api/tags"), {
		method: "POST",
		headers: { cookie, "content-type": "application/json" },
		body: JSON.stringify({ name }),
	});
	expect(res.status, "create tag should succeed").toBe(200);
	return (await res.json()) as Tag;
}

async function listTags(cookie: string): Promise<Tag[]> {
	const res = await SELF.fetch(url("/api/tags"), { headers: { cookie } });
	expect(res.status).toBe(200);
	return ((await res.json()) as { tags: Tag[] }).tags;
}

async function uploadPhoto(cookie: string, name = "p.png"): Promise<string> {
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

async function listPhotos(cookie: string, query = ""): Promise<PhotoRow[]> {
	const res = await SELF.fetch(url(`/api/photos${query}`), {
		headers: { cookie },
	});
	expect(res.status).toBe(200);
	return ((await res.json()) as { photos: PhotoRow[] }).photos;
}

describe("tags", () => {
	it("requires a name to create a tag", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/tags"), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ name: "  " }),
		});
		expect(res.status).toBe(400);
	});

	it("creates a tag and reuses it (case-insensitive) on re-create", async () => {
		const cookie = await login();
		const name = `Sunset${Date.now()}`;
		const first = await createTag(cookie, name);
		// Re-creating with different casing returns the same row, not a duplicate.
		const again = await createTag(cookie, name.toUpperCase());
		expect(again.id).toBe(first.id);
		const rows = await listTags(cookie);
		expect(rows.filter((t) => t.id === first.id)).toHaveLength(1);
	});

	it("attaches and detaches tags on a photo, exposing tag_ids in list rows", async () => {
		const cookie = await login();
		const tok = `at${Date.now()}`;
		const photoId = await uploadPhoto(cookie, `${tok}.png`);
		const tag = await createTag(cookie, `${tok}-tag`);

		// Attach by id.
		const attach = await SELF.fetch(url(`/api/photos/${photoId}/tags`), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ tagIds: [tag.id] }),
		});
		expect(attach.status).toBe(200);

		// The row now carries the tag id, and the tag's photo_count reflects it.
		let rows = await listPhotos(cookie, `?tag=${tag.id}`);
		expect(rows.some((p) => p.id === photoId)).toBe(true);
		expect(rows.find((p) => p.id === photoId)?.tag_ids).toBe(tag.id);
		expect(
			(await listTags(cookie)).find((t) => t.id === tag.id)?.photo_count,
		).toBe(1);

		// Filtering by the tag NAME works too (case-insensitive).
		const byName = await listPhotos(
			cookie,
			`?tag=${encodeURIComponent(`${tok}-tag`.toUpperCase())}`,
		);
		expect(byName.some((p) => p.id === photoId)).toBe(true);

		// Detach via query param (?tagIds=).
		const detach = await SELF.fetch(
			url(`/api/photos/${photoId}/tags?tagIds=${tag.id}`),
			{ method: "DELETE", headers: { cookie } },
		);
		expect(detach.status).toBe(200);

		rows = await listPhotos(cookie, `?tag=${tag.id}`);
		expect(rows.some((p) => p.id === photoId)).toBe(false);
		expect(
			(await listTags(cookie)).find((t) => t.id === tag.id)?.photo_count,
		).toBe(0);
	});

	it("attaches by name, creating the tag on the fly", async () => {
		const cookie = await login();
		const tok = `nm${Date.now()}`;
		const photoId = await uploadPhoto(cookie, `${tok}.png`);

		const attach = await SELF.fetch(url(`/api/photos/${photoId}/tags`), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ names: [`${tok}-new`] }),
		});
		expect(attach.status).toBe(200);

		// A tag with that name now exists and the photo carries it.
		const created = (await listTags(cookie)).find(
			(t) => t.name === `${tok}-new`,
		);
		expect(created).toBeDefined();
		const rows = await listPhotos(cookie, `?tag=${created?.id}`);
		expect(rows.some((p) => p.id === photoId)).toBe(true);
	});

	it("requires tagIds or names to attach", async () => {
		const cookie = await login();
		const photoId = await uploadPhoto(cookie);
		const res = await SELF.fetch(url(`/api/photos/${photoId}/tags`), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(400);
	});

	it("404s when attaching to an unknown photo", async () => {
		const cookie = await login();
		const tag = await createTag(cookie, `orphan${Date.now()}`);
		const res = await SELF.fetch(url("/api/photos/does-not-exist/tags"), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ tagIds: [tag.id] }),
		});
		expect(res.status).toBe(404);
	});

	it("cleans the junction when the photo is purged", async () => {
		const cookie = await login();
		const tok = `pd${Date.now()}`;
		const photoId = await uploadPhoto(cookie, `${tok}.png`);
		const tag = await createTag(cookie, `${tok}-tag`);
		await SELF.fetch(url(`/api/photos/${photoId}/tags`), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ tagIds: [tag.id] }),
		});
		expect(
			(await listTags(cookie)).find((t) => t.id === tag.id)?.photo_count,
		).toBe(1);

		// A soft delete (move to Trash) keeps the junction row.
		const del = await SELF.fetch(url(`/api/photos/${photoId}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(del.status).toBe(200);
		expect(
			(await listTags(cookie)).find((t) => t.id === tag.id)?.photo_count,
		).toBe(1);

		// Only a permanent purge cleans the junction — the tag survives, membership gone.
		const purge = await SELF.fetch(url(`/api/photos/${photoId}?purge=1`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(purge.status).toBe(200);
		expect(
			(await listTags(cookie)).find((t) => t.id === tag.id)?.photo_count,
		).toBe(0);
	});

	it("deletes a tag, cascading its junction rows but keeping the photo", async () => {
		const cookie = await login();
		const tok = `td${Date.now()}`;
		const photoId = await uploadPhoto(cookie, `${tok}.png`);
		const tag = await createTag(cookie, `${tok}-tag`);
		await SELF.fetch(url(`/api/photos/${photoId}/tags`), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ tagIds: [tag.id] }),
		});

		const del = await SELF.fetch(url(`/api/tags/${tag.id}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(del.status).toBe(200);

		// Tag gone from the list; the photo survives with no tag_ids.
		expect(
			(await listTags(cookie)).find((t) => t.id === tag.id),
		).toBeUndefined();
		const rows = await listPhotos(cookie, `?q=${tok}`);
		const row = rows.find((p) => p.id === photoId);
		expect(row).toBeDefined();
		expect(row?.tag_ids).toBeNull();
	});

	it("404s when deleting an unknown tag", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/tags/does-not-exist"), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(res.status).toBe(404);
	});
});
