import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { login, pngBytes, url } from "./helpers";

interface Photo {
	id: string;
	original_filename: string;
	camera_make: string | null;
	camera_model: string | null;
	lens_info: string | null;
	exposure: string | null;
	aperture: string | null;
	iso: number | null;
	focal_length: string | null;
	taken_at: string | null;
	gps_latitude: number | null;
	gps_longitude: number | null;
}

async function upload(cookie: string, filename: string): Promise<string> {
	const form = new FormData();
	form.append("file", new File([pngBytes()], filename, { type: "image/png" }));
	const res = await SELF.fetch(url("/api/photos"), {
		method: "POST",
		headers: { cookie },
		body: form,
	});
	expect(res.status).toBe(200);
	const body = (await res.json()) as { uploaded: { id: string }[] };
	return body.uploaded[0].id;
}

async function patch(
	cookie: string,
	id: string,
	body: Record<string, unknown>,
) {
	return SELF.fetch(url(`/api/photos/${id}`), {
		method: "PATCH",
		headers: { cookie, "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

async function getRow(cookie: string, id: string): Promise<Photo | undefined> {
	// The list carries the same shape the viewer consumes; find our row by id.
	const res = await SELF.fetch(url("/api/photos?limit=200"), {
		headers: { cookie },
	});
	expect(res.status).toBe(200);
	const { photos } = (await res.json()) as { photos: Photo[] };
	return photos.find((p) => p.id === id);
}

describe("PATCH /api/photos/[id]", () => {
	it("persists EXIF text edits and round-trips iso as a number", async () => {
		const cookie = await login();
		const id = await upload(cookie, `edit-${Date.now()}.png`);

		const res = await patch(cookie, id, {
			camera_make: "Fujifilm",
			camera_model: "X100V",
			lens_info: "23mm f/2",
			exposure: "1/250",
			aperture: "f/2.8",
			focal_length: "23mm",
			iso: 400,
		});
		expect(res.status).toBe(200);
		const { photo } = (await res.json()) as { photo: Photo };
		expect(photo.camera_make).toBe("Fujifilm");
		expect(photo.iso).toBe(400);
		expect(typeof photo.iso).toBe("number");

		// Survives a fresh read (UPSERT wrote the exif_data row).
		const row = await getRow(cookie, id);
		expect(row?.camera_model).toBe("X100V");
		expect(row?.lens_info).toBe("23mm f/2");
		expect(row?.aperture).toBe("f/2.8");
		expect(row?.iso).toBe(400);
	});

	it("renames via original_filename", async () => {
		const cookie = await login();
		const id = await upload(cookie, `oldname-${Date.now()}.png`);

		const res = await patch(cookie, id, { original_filename: "renamed.png" });
		expect(res.status).toBe(200);
		const { photo } = (await res.json()) as { photo: Photo };
		expect(photo.original_filename).toBe("renamed.png");

		const row = await getRow(cookie, id);
		expect(row?.original_filename).toBe("renamed.png");
	});

	it("coerces a blank iso to NULL", async () => {
		const cookie = await login();
		const id = await upload(cookie, `iso-${Date.now()}.png`);

		await patch(cookie, id, { iso: 800 });
		const cleared = await patch(cookie, id, { iso: "" });
		expect(cleared.status).toBe(200);
		const { photo } = (await cleared.json()) as { photo: Photo };
		expect(photo.iso).toBeNull();
	});

	it("ignores taken_at and GPS (display-only) — cannot move the photo", async () => {
		const cookie = await login();
		const id = await upload(cookie, `geo-${Date.now()}.png`);

		// Seed real coordinates + a date directly, like a geotagged image.
		await env.DB.prepare(
			"UPDATE exif_data SET gps_latitude = ?, gps_longitude = ?, taken_at = ? WHERE photo_id = ?",
		)
			.bind(37.8199, -122.4783, "2020-01-01 00:00:00", id)
			.run();

		const res = await patch(cookie, id, {
			gps_latitude: 0,
			gps_longitude: 0,
			taken_at: "1999-12-31 00:00:00",
			camera_make: "Nikon",
		});
		expect(res.status).toBe(200);
		const { photo } = (await res.json()) as { photo: Photo };
		// The editable field applied…
		expect(photo.camera_make).toBe("Nikon");
		// …but GPS + date are untouched.
		expect(photo.gps_latitude).toBeCloseTo(37.8199, 4);
		expect(photo.gps_longitude).toBeCloseTo(-122.4783, 4);
		expect(photo.taken_at).toBe("2020-01-01 00:00:00");
	});

	it("ignores unknown keys rather than 400", async () => {
		const cookie = await login();
		const id = await upload(cookie, `unknown-${Date.now()}.png`);

		const res = await patch(cookie, id, {
			bogus_field: "whatever",
			is_favorite: 1,
			camera_make: "Sony",
		});
		expect(res.status).toBe(200);
		const { photo } = (await res.json()) as { photo: Photo };
		expect(photo.camera_make).toBe("Sony");
		// The unknown is_favorite key was ignored (not persisted via this route).
		const row = (await getRow(cookie, id)) as Photo & { is_favorite: number };
		expect(row.is_favorite).toBe(0);
	});

	it("404s a soft-deleted photo", async () => {
		const cookie = await login();
		const id = await upload(cookie, `deleted-${Date.now()}.png`);

		const del = await SELF.fetch(url(`/api/photos/${id}`), {
			method: "DELETE",
			headers: { cookie },
		});
		expect(del.status).toBe(200);

		const res = await patch(cookie, id, { camera_make: "Canon" });
		expect(res.status).toBe(404);
	});

	it("404s an unknown photo id", async () => {
		const cookie = await login();
		const res = await patch(cookie, "does-not-exist", { camera_make: "X" });
		expect(res.status).toBe(404);
	});

	it("requires authentication", async () => {
		const res = await SELF.fetch(url("/api/photos/whatever"), {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ camera_make: "X" }),
		});
		expect(res.status).toBe(401);
	});
});
