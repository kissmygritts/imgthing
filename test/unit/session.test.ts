import { describe, expect, it } from "vitest";
import { timingSafeEqual } from "../../server/utils/session";

describe("timingSafeEqual", () => {
	it("is true for identical strings", () => {
		expect(timingSafeEqual("letmein", "letmein")).toBe(true);
		expect(timingSafeEqual("", "")).toBe(true);
	});
	it("is false for different content of equal length", () => {
		expect(timingSafeEqual("letmein", "letmeix")).toBe(false);
	});
	it("is false for different lengths", () => {
		expect(timingSafeEqual("letmein", "letmein-extra")).toBe(false);
		expect(timingSafeEqual("abc", "")).toBe(false);
	});
	it("handles multibyte characters", () => {
		expect(timingSafeEqual("café", "café")).toBe(true);
		expect(timingSafeEqual("café", "cafe")).toBe(false);
	});
});
