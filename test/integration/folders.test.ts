import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface Folder {
	id: string;
	name: string;
	parent_folder_id: string | null;
	photo_count: number;
}

async function createFolder(
	cookie: string,
	name: string,
	parentFolderId: string | null = null,
): Promise<{ id: string }> {
	const res = await SELF.fetch(url("/api/folders"), {
		method: "POST",
		headers: { cookie, "content-type": "application/json" },
		body: JSON.stringify({ name, parentFolderId }),
	});
	expect(res.status, "create folder should succeed").toBe(200);
	return (await res.json()) as { id: string };
}

async function listFolders(cookie: string): Promise<Folder[]> {
	const res = await SELF.fetch(url("/api/folders"), { headers: { cookie } });
	expect(res.status).toBe(200);
	return ((await res.json()) as { folders: Folder[] }).folders;
}

async function uploadPhoto(cookie: string): Promise<string> {
	const form = new FormData();
	form.append("file", new File([pngBytes()], "p.png", { type: "image/png" }));
	const res = await SELF.fetch(url("/api/photos"), {
		method: "POST",
		headers: { cookie },
		body: form,
	});
	expect(res.status).toBe(200);
	const { uploaded } = (await res.json()) as { uploaded: { id: string }[] };
	return uploaded[0].id;
}

describe("folders", () => {
	it("requires a name to create", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/folders"), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ name: "  " }),
		});
		expect(res.status).toBe(400);
	});

	it("creates, nests, renames, and lists folders", async () => {
		const cookie = await login();
		const parent = await createFolder(cookie, "Travel");
		const child = await createFolder(cookie, "Japan", parent.id);

		const folders = await listFolders(cookie);
		const parentRow = folders.find((f) => f.id === parent.id);
		const childRow = folders.find((f) => f.id === child.id);
		expect(parentRow?.parent_folder_id).toBeNull();
		expect(childRow?.parent_folder_id).toBe(parent.id);

		const renameRes = await SELF.fetch(url(`/api/folders/${parent.id}`), {
			method: "PATCH",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ name: "Trips" }),
		});
		expect(renameRes.status).toBe(200);
		const after = await listFolders(cookie);
		expect(after.find((f) => f.id === parent.id)?.name).toBe("Trips");
	});

	it("refuses to move a folder into its own descendant (cycle guard)", async () => {
		const cookie = await login();
		const parent = await createFolder(cookie, "A");
		const child = await createFolder(cookie, "B", parent.id);
		const res = await SELF.fetch(url(`/api/folders/${parent.id}`), {
			method: "PATCH",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ parentFolderId: child.id }),
		});
		expect(res.status).toBe(400);
	});

	it("adds and removes photos, and filters the photo listing by folder", async () => {
		const cookie = await login();
		const folder = await createFolder(cookie, "Album");
		const photoId = await uploadPhoto(cookie);

		// Add to the folder.
		const addRes = await SELF.fetch(url(`/api/folders/${folder.id}/photos`), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ photoIds: [photoId] }),
		});
		expect(addRes.status).toBe(200);

		// Filtered listing includes it; count reflects membership.
		const inFolder = await SELF.fetch(
			url(`/api/photos?folderId=${folder.id}`),
			{ headers: { cookie } },
		);
		const { photos } = (await inFolder.json()) as {
			photos: { id: string; folder_ids: string | null }[];
		};
		expect(photos.some((p) => p.id === photoId)).toBe(true);
		expect(listCount(await listFolders(cookie), folder.id)).toBe(1);

		// Remove it again.
		const delRes = await SELF.fetch(
			url(`/api/folders/${folder.id}/photos?photoIds=${photoId}`),
			{ method: "DELETE", headers: { cookie } },
		);
		expect(delRes.status).toBe(200);
		expect(listCount(await listFolders(cookie), folder.id)).toBe(0);

		// It now shows under "uncategorized".
		const uncat = await SELF.fetch(url("/api/photos?folderId=none"), {
			headers: { cookie },
		});
		const { photos: unfiled } = (await uncat.json()) as {
			photos: { id: string }[];
		};
		expect(unfiled.some((p) => p.id === photoId)).toBe(true);
	});

	it("bulk-adds and bulk-removes many photos in a single request", async () => {
		const cookie = await login();
		const folder = await createFolder(cookie, "Bulk");
		const ids = [
			await uploadPhoto(cookie),
			await uploadPhoto(cookie),
			await uploadPhoto(cookie),
		];

		// One POST carries every id.
		const addRes = await SELF.fetch(url(`/api/folders/${folder.id}/photos`), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ photoIds: ids }),
		});
		expect(addRes.status).toBe(200);
		expect((await addRes.json()) as { added: number }).toMatchObject({
			added: 3,
		});
		expect(listCount(await listFolders(cookie), folder.id)).toBe(3);

		// One DELETE (comma-joined query) removes all three at once.
		const delRes = await SELF.fetch(
			url(`/api/folders/${folder.id}/photos?photoIds=${ids.join(",")}`),
			{ method: "DELETE", headers: { cookie } },
		);
		expect(delRes.status).toBe(200);
		expect((await delRes.json()) as { removed: number }).toMatchObject({
			removed: 3,
		});
		expect(listCount(await listFolders(cookie), folder.id)).toBe(0);
	});

	it("deleting a folder cascades to subfolders but keeps photos", async () => {
		const cookie = await login();
		const parent = await createFolder(cookie, "Parent");
		const child = await createFolder(cookie, "Child", parent.id);
		const photoId = await uploadPhoto(cookie);
		await SELF.fetch(url(`/api/folders/${child.id}/photos`), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ photoIds: [photoId] }),
		});

		const delRes = await SELF.fetch(url(`/api/folders/${parent.id}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(delRes.status).toBe(200);

		const folders = await listFolders(cookie);
		expect(folders.find((f) => f.id === parent.id)).toBeUndefined();
		expect(folders.find((f) => f.id === child.id)).toBeUndefined();

		// The photo itself survives.
		const raw = await SELF.fetch(url(`/api/photos/${photoId}/raw`), {
			headers: { cookie },
		});
		expect(raw.status).toBe(200);
	});

	it("returns 404 for an unknown folder", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/folders/nope/photos"), {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ photoIds: ["x"] }),
		});
		expect(res.status).toBe(404);
	});

	it("returns 404 when deleting an unknown folder", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/folders/does-not-exist"), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(res.status).toBe(404);
	});

	it("returns 404 when renaming an unknown folder", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/folders/does-not-exist"), {
			method: "PATCH",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ name: "Renamed" }),
		});
		expect(res.status).toBe(404);
	});
});

function listCount(folders: Folder[], id: string): number {
	return folders.find((f) => f.id === id)?.photo_count ?? -1;
}
