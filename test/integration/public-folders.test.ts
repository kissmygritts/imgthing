import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

// The public token shape enforced by both /f/** routes (16 random bytes, hex).
const TOKEN_RE = /^[0-9a-f]{32}$/;

/** Upload a photo through the real API and return its id. */
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
	return ((await res.json()) as { uploaded: { id: string }[] }).uploaded[0].id;
}

async function createFolder(cookie: string, name: string): Promise<string> {
	const res = await SELF.fetch(url("/api/folders"), {
		method: "POST",
		headers: { cookie, "content-type": "application/json" },
		body: JSON.stringify({ name }),
	});
	expect(res.status, "create folder should succeed").toBe(200);
	return ((await res.json()) as { id: string }).id;
}

async function addToFolder(
	cookie: string,
	folderId: string,
	photoIds: string[],
): Promise<void> {
	const res = await SELF.fetch(url(`/api/folders/${folderId}/photos`), {
		method: "POST",
		headers: { cookie, "content-type": "application/json" },
		body: JSON.stringify({ photoIds }),
	});
	expect(res.status, "add to folder should succeed").toBe(200);
}

interface PublishResponse {
	token: string;
	url: string;
}

async function publishFolder(
	cookie: string,
	folderId: string,
): Promise<PublishResponse> {
	const res = await SELF.fetch(url(`/api/folders/${folderId}/publish`), {
		method: "POST",
		headers: { cookie },
	});
	expect(res.status, "publish should succeed").toBe(200);
	return (await res.json()) as PublishResponse;
}

async function unpublishFolder(
	cookie: string,
	folderId: string,
): Promise<void> {
	const res = await SELF.fetch(url(`/api/folders/${folderId}/unpublish`), {
		method: "POST",
		headers: { cookie },
	});
	expect(res.status, "unpublish should succeed").toBe(200);
}

async function trashPhoto(cookie: string, id: string): Promise<void> {
	const res = await SELF.fetch(url(`/api/photos/${id}`), {
		method: "DELETE",
		headers: { cookie },
	});
	expect(res.status).toBe(200);
}

/** Public GET with NO session cookie — the real unauthenticated surface. */
function pub(path: string): Promise<Response> {
	return SELF.fetch(url(path));
}

/** Seed a folder with N photos and publish it. Returns folder id, token, ids. */
async function seedPublished(
	cookie: string,
	name: string,
	filenames: string[],
): Promise<{ folderId: string; token: string; ids: string[] }> {
	const folderId = await createFolder(cookie, name);
	const ids: string[] = [];
	for (const f of filenames) ids.push(await upload(cookie, f));
	await addToFolder(cookie, folderId, ids);
	const { token } = await publishFolder(cookie, folderId);
	return { folderId, token, ids };
}

describe("folders public: publish + auth", () => {
	it("requires auth to publish (401 without a session cookie)", async () => {
		const res = await SELF.fetch(url("/api/folders/whatever/publish"), {
			method: "POST",
		});
		expect(res.status).toBe(401);
	});

	it("mints a 32-hex token plus a fully-qualified /f/ share url", async () => {
		const cookie = await login();
		const folderId = await createFolder(cookie, "Iceland 2026");
		const { token, url: shareUrl } = await publishFolder(cookie, folderId);

		expect(token).toMatch(TOKEN_RE);
		// URL is fully-qualified against the request origin, with the cosmetic slug
		// and the token on the query string.
		expect(shareUrl).toMatch(/^https?:\/\/example\.com\/f\//);
		expect(shareUrl.endsWith(`?token=${token}`)).toBe(true);
		expect(shareUrl).toContain("/f/iceland-2026?token=");
	});

	it("is idempotent: re-publish returns the SAME token (no rotation)", async () => {
		const cookie = await login();
		const folderId = await createFolder(cookie, "Stable");
		const { token: first } = await publishFolder(cookie, folderId);
		const { token: second } = await publishFolder(cookie, folderId);
		expect(second).toBe(first);
	});

	it("unpublish clears the token; the old link then 404s", async () => {
		const cookie = await login();
		const { folderId, token, ids } = await seedPublished(cookie, "Revoke", [
			"a.png",
		]);
		// Live before revocation.
		expect((await pub(`/f/x/list?token=${token}`)).status).toBe(200);
		expect((await pub(`/f/x/${ids[0]}/thumb?token=${token}`)).status).toBe(200);

		await unpublishFolder(cookie, folderId);
		expect((await pub(`/f/x/list?token=${token}`)).status).toBe(404);
		expect((await pub(`/f/x/${ids[0]}/thumb?token=${token}`)).status).toBe(404);
	});

	it("publish on a missing folder → 404", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/folders/does-not-exist/publish"), {
			method: "POST",
			headers: { cookie },
		});
		expect(res.status).toBe(404);
	});

	it("folder delete cascades away the token (link 404s)", async () => {
		const cookie = await login();
		const { folderId, token, ids } = await seedPublished(cookie, "Doomed", [
			"d.png",
		]);
		expect((await pub(`/f/x/list?token=${token}`)).status).toBe(200);

		const del = await SELF.fetch(url(`/api/folders/${folderId}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(del.status).toBe(200);
		expect((await pub(`/f/x/list?token=${token}`)).status).toBe(404);
		expect((await pub(`/f/x/${ids[0]}/thumb?token=${token}`)).status).toBe(404);
	});
});

describe("folders public: list manifest", () => {
	it("returns members only, excludes non-members and trashed, never leaks r2_key", async () => {
		const cookie = await login();
		const { folderId, token, ids } = await seedPublished(cookie, "Trip", [
			"one.png",
			"two.png",
		]);

		// A photo that exists but is NOT in the folder.
		const outsider = await upload(cookie, "outsider.png");

		const res = await pub(`/f/x/list?token=${token}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			folderName: string;
			photos: { id: string; filename: string }[];
		};
		expect(body.folderName).toBe("Trip");
		const memberIds = body.photos.map((p) => p.id).sort();
		expect(memberIds).toEqual([...ids].sort());
		expect(memberIds).not.toContain(outsider);
		// Whitelisted manifest: only id + filename, no r2_key or internal fields.
		expect(JSON.stringify(body)).not.toContain("r2_key");
		for (const p of body.photos) {
			expect(Object.keys(p).sort()).toEqual(["filename", "id"]);
		}

		// Trash one member → it drops from the manifest immediately (live resolution).
		await trashPhoto(cookie, ids[0]);
		const after = (await pub(`/f/x/list?token=${token}`)).clone();
		const afterBody = (await after.json()) as {
			photos: { id: string }[];
		};
		expect(afterBody.photos.map((p) => p.id)).toEqual([ids[1]]);
		void folderId;
	});

	it("an empty published folder still lists (200, empty photos)", async () => {
		const cookie = await login();
		const folderId = await createFolder(cookie, "Empty");
		const { token } = await publishFolder(cookie, folderId);
		const res = await pub(`/f/x/list?token=${token}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { photos: unknown[] };
		expect(body.photos).toEqual([]);
	});

	it("bad shape, unknown, and unpublished tokens all 404 identically", async () => {
		// Malformed (fails the shape guard before D1).
		expect((await pub("/f/x/list?token=not-a-real-token")).status).toBe(404);
		// Missing token entirely.
		expect((await pub("/f/x/list")).status).toBe(404);
		// Valid 32-hex shape but no matching folder.
		const orphan = "0".repeat(32);
		expect(orphan).toMatch(TOKEN_RE);
		expect((await pub(`/f/x/list?token=${orphan}`)).status).toBe(404);
	});
});

describe("folders public: byte serving", () => {
	it("serves a member's webp without a session, publicly cacheable", async () => {
		const cookie = await login();
		const { token, ids } = await seedPublished(cookie, "Bytes", ["b.png"]);

		const res = await pub(`/f/x/${ids[0]}/md?token=${token}`);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("image/webp");
		expect(res.headers.get("cache-control")).toContain("public");
		expect(new Uint8Array(await res.arrayBuffer()).byteLength).toBeGreaterThan(
			0,
		);
	});

	it("404s a non-member id, a trashed member, a bad size, and a bad token", async () => {
		const cookie = await login();
		const { token, ids } = await seedPublished(cookie, "Guarded", [
			"g1.png",
			"g2.png",
		]);
		const outsider = await upload(cookie, "outsider2.png");

		// Non-member id through a valid token — the membership join must reject it,
		// or the token would be a bearer credential for any photo id.
		expect((await pub(`/f/x/${outsider}/md?token=${token}`)).status).toBe(404);
		// Bad size on a real member.
		expect((await pub(`/f/x/${ids[0]}/huge?token=${token}`)).status).toBe(404);
		// Bad token shape.
		expect((await pub(`/f/x/${ids[0]}/md?token=nope`)).status).toBe(404);
		// Sanity: the member still serves.
		expect((await pub(`/f/x/${ids[0]}/md?token=${token}`)).status).toBe(200);

		// Trash a member → its bytes 404 through the token (deleted_at bypass check).
		await trashPhoto(cookie, ids[1]);
		expect((await pub(`/f/x/${ids[1]}/md?token=${token}`)).status).toBe(404);
	});

	it("self-heals a deleted variant object on the next request", async () => {
		const cookie = await login();
		const { token, ids } = await seedPublished(cookie, "Heal", ["h.png"]);
		const id = ids[0];

		// Prime the cache (generates + stores variants in R2).
		expect((await pub(`/f/x/${id}/md?token=${token}`)).status).toBe(200);

		// Delete the `md` variant straight out of R2.
		await env.BUCKET.delete(`variants/${id}/md`);
		expect(await env.BUCKET.get(`variants/${id}/md`)).toBeNull();

		// The public folder route regenerates on the miss and still serves webp.
		const healed = await pub(`/f/x/${id}/md?token=${token}`);
		expect(healed.status).toBe(200);
		expect(healed.headers.get("content-type")).toBe("image/webp");
	});
});

describe("folders public: gallery page (risk #1 — real 404, not the 200 shell)", () => {
	it("a bad token renders a REAL 404 status (not the app-shell trap)", async () => {
		const res = await pub("/f/x?token=bad");
		expect(res.status).toBe(404);
	});

	it("an unknown (well-shaped) token also 404s", async () => {
		const orphan = "0".repeat(32);
		const res = await pub(`/f/x?token=${orphan}`);
		expect(res.status).toBe(404);
	});

	it("a valid token renders 200 HTML containing the folder name", async () => {
		const cookie = await login();
		const { token } = await seedPublished(cookie, "Sunset Ridge", ["s.png"]);

		const res = await pub(`/f/sunset-ridge?token=${token}`);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const html = await res.text();
		expect(html).toContain("Sunset Ridge");
	});
});

describe("folders public: independence from per-photo visibility", () => {
	it("a private photo serves through a published folder, but its authed variant still 401s unauthenticated", async () => {
		const cookie = await login();
		const { token, ids } = await seedPublished(cookie, "Union", ["u.png"]);
		const id = ids[0];

		// The photo was never per-photo published — it's private. Through the folder
		// token it serves publicly (the token bypasses each member's own visibility).
		expect((await pub(`/f/x/${id}/md?token=${token}`)).status).toBe(200);

		// Yet its authenticated per-photo variant route still requires a session.
		const authed = await pub(`/api/photos/${id}/variant?size=md`);
		expect(authed.status).toBe(401);
	});
});
