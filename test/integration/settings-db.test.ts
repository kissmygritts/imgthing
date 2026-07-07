import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface UploadResponse {
	ok: boolean;
	uploaded: { id: string; original_filename: string }[];
}

interface TableData {
	table: string;
	columns: string[];
	rows: Record<string, unknown>[];
	total: number;
	limit: number;
	offset: number;
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

describe("GET /api/settings/db/[table]", () => {
	it("returns columns + rows for an allow-listed table", async () => {
		const cookie = await login();
		await upload(cookie, `db-a-${Date.now()}.png`);

		const res = await SELF.fetch(url("/api/settings/db/photos"), {
			headers: { cookie },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as TableData;
		expect(body.table).toBe("photos");
		// Column headers come from PRAGMA, so they render even for an empty table.
		expect(body.columns).toContain("id");
		expect(body.columns).toContain("original_filename");
		expect(body.total).toBeGreaterThanOrEqual(1);
		expect(body.rows.length).toBeGreaterThanOrEqual(1);
		// Each row is keyed by the reported columns.
		expect(Object.keys(body.rows[0])).toEqual(
			expect.arrayContaining(["id", "original_filename"]),
		);
	});

	it("clamps limit and honours offset for paging", async () => {
		const cookie = await login();
		await upload(cookie, `db-b-${Date.now()}.png`);
		await upload(cookie, `db-c-${Date.now()}.png`);

		const res = await SELF.fetch(
			url("/api/settings/db/photos?limit=1&offset=0"),
			{ headers: { cookie } },
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as TableData;
		expect(body.limit).toBe(1);
		expect(body.rows.length).toBe(1);
		expect(body.total).toBeGreaterThanOrEqual(2);
	});

	it("404s for a non-allow-listed table (login_attempts)", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/settings/db/login_attempts"), {
			headers: { cookie },
		});
		expect(res.status).toBe(404);
	});

	it("404s for sqlite_master", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/settings/db/sqlite_master"), {
			headers: { cookie },
		});
		expect(res.status).toBe(404);
	});

	it("404s for a bogus table name", async () => {
		const cookie = await login();
		const res = await SELF.fetch(url("/api/settings/db/bogus"), {
			headers: { cookie },
		});
		expect(res.status).toBe(404);
	});

	it("requires auth (401 without a session cookie)", async () => {
		const res = await SELF.fetch(url("/api/settings/db/photos"));
		expect(res.status).toBe(401);
	});
});
