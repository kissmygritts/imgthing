import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface UploadResponse {
	uploaded: { id: string; original_filename: string }[];
}

// Upload one tiny PNG under a unique filename and return its id.
async function uploadOne(cookie: string, filename: string): Promise<string> {
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

async function uploadMany(
	cookie: string,
	tok: string,
	n: number,
): Promise<string[]> {
	const ids: string[] = [];
	for (let i = 0; i < n; i++)
		ids.push(await uploadOne(cookie, `${tok}-${i}.png`));
	return ids;
}

function post(path: string, cookie: string, body: unknown) {
	return SELF.fetch(url(path), {
		method: "POST",
		headers: { cookie, "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("photos batch: favorite", () => {
	it("sets the favorite flag on many photos to an explicit value", async () => {
		const cookie = await login();
		const ids = await uploadMany(cookie, `bfav${Date.now()}`, 3);

		// value:true → all three become favorites.
		const on = await post("/api/photos/favorite", cookie, { ids, value: true });
		expect(on.status).toBe(200);
		const onBody = (await on.json()) as { updated: number; ids: string[] };
		expect(onBody.updated).toBe(3);
		expect(new Set(onBody.ids)).toEqual(new Set(ids));

		const flagged = await env.DB.prepare(
			`SELECT COUNT(*) AS n FROM photos WHERE is_favorite = 1 AND id IN (${ids.map(() => "?").join(",")})`,
		)
			.bind(...ids)
			.first<{ n: number }>();
		expect(flagged?.n).toBe(3);

		// value:false → deterministically clears them (not a per-item toggle).
		const off = await post("/api/photos/favorite", cookie, {
			ids,
			value: false,
		});
		expect(off.status).toBe(200);
		const cleared = await env.DB.prepare(
			`SELECT COUNT(*) AS n FROM photos WHERE is_favorite = 1 AND id IN (${ids.map(() => "?").join(",")})`,
		)
			.bind(...ids)
			.first<{ n: number }>();
		expect(cleared?.n).toBe(0);
	});

	it("400s when ids is missing", async () => {
		const cookie = await login();
		const res = await post("/api/photos/favorite", cookie, { value: true });
		expect(res.status).toBe(400);
	});

	it("requires authentication", async () => {
		const res = await SELF.fetch(url("/api/photos/favorite"), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ ids: ["x"], value: true }),
		});
		expect(res.status).toBe(401);
	});
});

describe("photos batch: publish / unpublish", () => {
	it("publishes only the not-yet-published ids and leaves existing tokens intact", async () => {
		const cookie = await login();
		const ids = await uploadMany(cookie, `bpub${Date.now()}`, 3);

		// Pre-publish the first photo individually to capture its token.
		const single = await post(`/api/photos/${ids[0]}/publish`, cookie, {});
		expect(single.status).toBe(200);
		const priorToken = ((await single.json()) as { token: string }).token;

		// Batch publish all three: only the two unpublished should change.
		const res = await post("/api/photos/publish", cookie, { ids });
		expect(res.status).toBe(200);
		const body = (await res.json()) as { published: number; ids: string[] };
		expect(body.published).toBe(2);
		expect(new Set(body.ids)).toEqual(new Set([ids[1], ids[2]]));

		const rows = await env.DB.prepare(
			`SELECT id, visibility, public_token FROM photos WHERE id IN (${ids.map(() => "?").join(",")})`,
		)
			.bind(...ids)
			.all<{ id: string; visibility: string; public_token: string }>();
		const byId = new Map(rows.results.map((r) => [r.id, r]));
		// All public now …
		expect(rows.results.every((r) => r.visibility === "public")).toBe(true);
		// … but the already-published photo kept its original token (no rotation).
		expect(byId.get(ids[0])?.public_token).toBe(priorToken);
		// The freshly-published ones carry non-null tokens.
		expect(byId.get(ids[1])?.public_token).toBeTruthy();
		expect(byId.get(ids[2])?.public_token).toBeTruthy();
	});

	it("unpublishes many photos, clearing every token", async () => {
		const cookie = await login();
		const ids = await uploadMany(cookie, `bunpub${Date.now()}`, 2);
		await post("/api/photos/publish", cookie, { ids });

		const res = await post("/api/photos/unpublish", cookie, { ids });
		expect(res.status).toBe(200);
		const body = (await res.json()) as { unpublished: number };
		expect(body.unpublished).toBe(2);

		const rows = await env.DB.prepare(
			`SELECT visibility, public_token FROM photos WHERE id IN (${ids.map(() => "?").join(",")})`,
		)
			.bind(...ids)
			.all<{ visibility: string; public_token: string | null }>();
		expect(
			rows.results.every(
				(r) => r.visibility === "private" && r.public_token === null,
			),
		).toBe(true);
	});

	it("publish requires authentication", async () => {
		const res = await SELF.fetch(url("/api/photos/publish"), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ ids: ["x"] }),
		});
		expect(res.status).toBe(401);
	});

	it("unpublish requires authentication", async () => {
		const res = await SELF.fetch(url("/api/photos/unpublish"), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ ids: ["x"] }),
		});
		expect(res.status).toBe(401);
	});
});

describe("photos batch: tags", () => {
	it("attaches the same tag to many photos, idempotently", async () => {
		const cookie = await login();
		const ids = await uploadMany(cookie, `btag${Date.now()}`, 3);
		const tagName = `batch-tag-${Date.now()}`;

		const res = await post("/api/photos/tags", cookie, {
			ids,
			names: [tagName],
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { attached: number; tagIds: string[] };
		expect(body.tagIds).toHaveLength(1);

		// The list filtered by that tag returns all three photos.
		const listRes = await SELF.fetch(url(`/api/photos?tag=${tagName}`), {
			headers: { cookie },
		});
		expect(listRes.status).toBe(200);
		const listed = (await listRes.json()) as { total: number };
		expect(listed.total).toBe(3);

		// A repeat call is a no-op (idempotent) — still exactly three tagged.
		const again = await post("/api/photos/tags", cookie, {
			ids,
			names: [tagName],
		});
		expect(again.status).toBe(200);
		const after = await SELF.fetch(url(`/api/photos?tag=${tagName}`), {
			headers: { cookie },
		});
		expect(((await after.json()) as { total: number }).total).toBe(3);
	});

	it("400s when ids is missing", async () => {
		const cookie = await login();
		const res = await post("/api/photos/tags", cookie, { names: ["x"] });
		expect(res.status).toBe(400);
	});

	it("400s when neither names nor tagIds is given", async () => {
		const cookie = await login();
		const res = await post("/api/photos/tags", cookie, { ids: ["x"] });
		expect(res.status).toBe(400);
	});

	it("requires authentication", async () => {
		const res = await SELF.fetch(url("/api/photos/tags"), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ ids: ["x"], names: ["y"] }),
		});
		expect(res.status).toBe(401);
	});
});

describe("photos batch: restore", () => {
	it("restores many trashed photos back to the live library", async () => {
		const cookie = await login();
		const ids = await uploadMany(cookie, `brest${Date.now()}`, 2);

		// Soft-delete both (ids ride the query string, per convention).
		const del = await SELF.fetch(url(`/api/photos?ids=${ids.join(",")}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(del.status).toBe(200);

		// Batch restore.
		const res = await post("/api/photos/restore", cookie, { ids });
		expect(res.status).toBe(200);
		const body = (await res.json()) as { restored: number; ids: string[] };
		expect(body.restored).toBe(2);

		// Both are live again (deleted_at cleared) and never re-published.
		const rows = await env.DB.prepare(
			`SELECT deleted_at, visibility FROM photos WHERE id IN (${ids.map(() => "?").join(",")})`,
		)
			.bind(...ids)
			.all<{ deleted_at: string | null; visibility: string }>();
		expect(
			rows.results.every(
				(r) => r.deleted_at === null && r.visibility === "private",
			),
		).toBe(true);
	});

	it("400s when ids is missing", async () => {
		const cookie = await login();
		const res = await post("/api/photos/restore", cookie, {});
		expect(res.status).toBe(400);
	});

	it("requires authentication", async () => {
		const res = await SELF.fetch(url("/api/photos/restore"), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ ids: ["x"] }),
		});
		expect(res.status).toBe(401);
	});
});
