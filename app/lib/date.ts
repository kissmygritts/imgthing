// Date helpers for the calendar view. Pure, no I/O — the single source of truth
// for turning a month key into the gallery's date range, so the boundary logic
// that caused the reverted F2 bug lives in one tested place.

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

/**
 * Turn a `"YYYY-MM"` month key into the half-open range the gallery filters on:
 * `[month-start, next-month-start)`. `from` is inclusive, `to` is exclusive —
 * `to` is the first day of the *next* month so the whole target month is covered
 * regardless of a photo's time-of-day, and December rolls over into next January.
 *
 *   monthRange("2026-07") → { from: "2026-07-01", to: "2026-08-01" }
 *   monthRange("2025-12") → { from: "2025-12-01", to: "2026-01-01" }
 */
export function monthRange(monthKey: string): { from: string; to: string } {
	const parts = monthKey.split("-");
	const year = Number(parts[0]);
	const month = Number(parts[1]);
	const nextMonth = month === 12 ? 1 : month + 1;
	const nextYear = month === 12 ? year + 1 : year;
	const pad = (n: number) => String(n).padStart(2, "0");
	return {
		from: `${year}-${pad(month)}-01`,
		to: `${nextYear}-${pad(nextMonth)}-01`,
	};
}

/**
 * Human label for a month key: `"2026-07"` → `"July 2026"`. Uses a fixed name
 * table (no `Date`/locale) so it stays pure and timezone-proof.
 */
export function monthLabel(monthKey: string): string {
	const parts = monthKey.split("-");
	const year = Number(parts[0]);
	const month = Number(parts[1]);
	return `${MONTH_NAMES[month - 1] ?? monthKey} ${year}`;
}
