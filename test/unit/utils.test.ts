import { describe, expect, it } from "vitest";
import { humanBytes } from "../../app/lib/utils";

describe("humanBytes", () => {
	it("returns '0 B' for zero, negatives, and non-finite input", () => {
		expect(humanBytes(0)).toBe("0 B");
		expect(humanBytes(-5)).toBe("0 B");
		expect(humanBytes(Number.NaN)).toBe("0 B");
	});

	it("formats raw bytes with no decimal", () => {
		expect(humanBytes(1)).toBe("1 B");
		expect(humanBytes(512)).toBe("512 B");
	});

	it("scales into binary KB/MB/GB with one decimal", () => {
		expect(humanBytes(1024)).toBe("1.0 KB");
		expect(humanBytes(1536)).toBe("1.5 KB");
		expect(humanBytes(1024 * 1024)).toBe("1.0 MB");
		expect(humanBytes(1024 ** 3 * 8.6)).toBe("8.6 GB");
	});

	it("caps at TB for very large values", () => {
		expect(humanBytes(1024 ** 4)).toBe("1.0 TB");
		expect(humanBytes(1024 ** 5)).toBe("1024.0 TB");
	});
});
