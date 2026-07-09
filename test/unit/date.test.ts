import { describe, expect, it } from "vitest";
import { monthLabel, monthRange } from "../../app/lib/date";

// monthRange is where the calendar's correctness is subtle — it's where the
// reverted F2 date-boundary bug hid. Assert the returned range values directly.
describe("monthRange", () => {
	it("returns a half-open [month-start, next-month-start) range", () => {
		expect(monthRange("2026-07")).toEqual({
			from: "2026-07-01",
			to: "2026-08-01",
		});
	});

	it("rolls December over into the next January", () => {
		expect(monthRange("2025-12")).toEqual({
			from: "2025-12-01",
			to: "2026-01-01",
		});
	});

	it("zero-pads single-digit months in both from and to", () => {
		expect(monthRange("2026-01")).toEqual({
			from: "2026-01-01",
			to: "2026-02-01",
		});
		// September → October keeps both sides two-digit.
		expect(monthRange("2026-09")).toEqual({
			from: "2026-09-01",
			to: "2026-10-01",
		});
	});

	it("makes from inclusive and to exclusive (to is the next month's first day)", () => {
		const { from, to } = monthRange("2026-04");
		expect(from).toBe("2026-04-01"); // the first captured day is included
		expect(to).toBe("2026-05-01"); // May 1 bounds the range but is excluded
	});
});

describe("monthLabel", () => {
	it("formats a month key as a human label", () => {
		expect(monthLabel("2026-07")).toBe("July 2026");
		expect(monthLabel("2025-12")).toBe("December 2025");
		expect(monthLabel("2026-01")).toBe("January 2026");
	});
});
