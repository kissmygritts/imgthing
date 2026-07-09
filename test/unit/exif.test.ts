import { describe, expect, it } from "vitest";
import {
	extractExif,
	formatAperture,
	formatExposure,
	formatFocalLength,
	str,
	toDimension,
	toIso,
} from "../../server/utils/exif";

// A 1x1 PNG has no EXIF — extractExif should return an all-null record.
const PNG_1X1 = Uint8Array.from(
	atob(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	),
	(c) => c.charCodeAt(0),
).buffer;

describe("formatExposure", () => {
	it("renders sub-second shutter as a fraction", () => {
		expect(formatExposure(1 / 200)).toBe("1/200");
		expect(formatExposure(0.005)).toBe("1/200");
	});
	it("renders >=1s exposures with an s suffix", () => {
		expect(formatExposure(1)).toBe("1s");
		expect(formatExposure(2.5)).toBe("2.5s");
	});
	it("rejects non-positive / non-numeric input", () => {
		expect(formatExposure(0)).toBeNull();
		expect(formatExposure(-1)).toBeNull();
		expect(formatExposure(Number.NaN)).toBeNull();
		expect(formatExposure("1/200")).toBeNull();
		expect(formatExposure(null)).toBeNull();
	});
});

describe("formatAperture", () => {
	it("prefixes with f/", () => {
		expect(formatAperture(1.8)).toBe("f/1.8");
		expect(formatAperture(11)).toBe("f/11");
	});
	it("rejects non-numeric", () => {
		expect(formatAperture(Number.NaN)).toBeNull();
		expect(formatAperture(undefined)).toBeNull();
	});
});

describe("formatFocalLength", () => {
	it("rounds and adds mm", () => {
		expect(formatFocalLength(35)).toBe("35mm");
		expect(formatFocalLength(23.4)).toBe("23mm");
	});
	it("rejects non-numeric", () => {
		expect(formatFocalLength("35")).toBeNull();
	});
});

describe("toIso", () => {
	it("converts a Date to ISO 8601", () => {
		expect(toIso(new Date("2026-01-02T03:04:05Z"))).toBe(
			"2026-01-02T03:04:05.000Z",
		);
	});
	it("rejects invalid dates and non-dates", () => {
		expect(toIso(new Date("nope"))).toBeNull();
		expect(toIso("2026-01-02")).toBeNull();
		expect(toIso(null)).toBeNull();
	});
});

describe("str", () => {
	it("trims and nulls empties", () => {
		expect(str("  Canon ")).toBe("Canon");
		expect(str("")).toBeNull();
		expect(str("   ")).toBeNull();
		expect(str(null)).toBeNull();
		expect(str(42)).toBe("42");
	});
});

describe("toDimension", () => {
	it("rounds a positive number to an integer", () => {
		expect(toDimension(4032)).toBe(4032);
		expect(toDimension(1234.6)).toBe(1235);
	});
	it("rejects zero, negatives and non-numbers", () => {
		expect(toDimension(0)).toBeNull();
		expect(toDimension(-10)).toBeNull();
		expect(toDimension("4032")).toBeNull();
		expect(toDimension(null)).toBeNull();
		expect(toDimension(Number.NaN)).toBeNull();
	});
});

describe("extractExif", () => {
	it("returns all-null for an image without EXIF", async () => {
		const rec = await extractExif(PNG_1X1);
		expect(rec.camera_make).toBeNull();
		expect(rec.taken_at).toBeNull();
		expect(rec.gps_latitude).toBeNull();
		// exifr still reports the raw pixel dimensions even with no camera EXIF.
		expect(rec.width).toBe(1);
		expect(rec.height).toBe(1);
	});
	it("never throws on non-image bytes", async () => {
		const garbage = new TextEncoder().encode("not an image").buffer;
		const rec = await extractExif(garbage);
		expect(rec.camera_model).toBeNull();
		expect(rec.other_data).toBeNull();
	});
});
