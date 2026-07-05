import exifr from "exifr";

/** EXIF fields mapped onto the `exif_data` table columns, plus raw leftovers. */
export interface ExifRecord {
	camera_make: string | null;
	camera_model: string | null;
	lens_info: string | null;
	exposure: string | null;
	aperture: string | null;
	iso: number | null;
	focal_length: string | null;
	taken_at: string | null; // ISO 8601
	gps_latitude: number | null;
	gps_longitude: number | null;
	other_data: string | null; // JSON of everything parsed
}

export function str(v: unknown): string | null {
	if (v == null) return null;
	const s = String(v).trim();
	return s.length ? s : null;
}

/** ExposureTime is seconds as a float; render as a shutter fraction like "1/200". */
export function formatExposure(v: unknown): string | null {
	if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
	if (v >= 1) return `${Math.round(v * 10) / 10}s`;
	return `1/${Math.round(1 / v)}`;
}

export function formatAperture(v: unknown): string | null {
	if (typeof v !== "number" || !Number.isFinite(v)) return null;
	return `f/${v}`;
}

export function formatFocalLength(v: unknown): string | null {
	if (typeof v !== "number" || !Number.isFinite(v)) return null;
	return `${Math.round(v)}mm`;
}

export function toIso(v: unknown): string | null {
	if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
	return null;
}

/**
 * Parse EXIF from image bytes into a flat record. Never throws — images without
 * EXIF (PNGs, screenshots, stripped JPEGs) return all-null fields.
 */
export async function extractExif(bytes: ArrayBuffer): Promise<ExifRecord> {
	const empty: ExifRecord = {
		camera_make: null,
		camera_model: null,
		lens_info: null,
		exposure: null,
		aperture: null,
		iso: null,
		focal_length: null,
		taken_at: null,
		gps_latitude: null,
		gps_longitude: null,
		other_data: null,
	};

	let output: Record<string, unknown> | undefined;
	try {
		// `ifd0` is always parsed as part of the TIFF block, so it isn't listed here.
		output = await exifr.parse(bytes, {
			tiff: true,
			exif: true,
			gps: true,
			mergeOutput: true,
		});
	} catch {
		return empty;
	}
	if (!output) return empty;

	const iso = output.ISO;
	return {
		camera_make: str(output.Make),
		camera_model: str(output.Model),
		lens_info: str(output.LensModel ?? output.LensInfo),
		exposure: formatExposure(output.ExposureTime),
		aperture: formatAperture(output.FNumber),
		iso: typeof iso === "number" ? Math.round(iso) : null,
		focal_length: formatFocalLength(output.FocalLength),
		taken_at: toIso(output.DateTimeOriginal ?? output.CreateDate),
		gps_latitude: typeof output.latitude === "number" ? output.latitude : null,
		gps_longitude:
			typeof output.longitude === "number" ? output.longitude : null,
		other_data: JSON.stringify(output),
	};
}
