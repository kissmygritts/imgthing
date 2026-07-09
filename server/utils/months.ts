// One entry per month that has live photos, for the calendar's months overview.
export interface MonthSummary {
	/** `"YYYY-MM"` — the capture month (taken_at, falling back to uploaded_at). */
	month: string;
	/** Live photos captured in that month. */
	count: number;
	/** Newest-first photo ids for the month row's thumb strip (up to `thumbCount`). */
	thumbs: string[];
}

/**
 * Summarize the library by capture month, newest month first. Live photos only
 * (`deleted_at IS NULL`). The grouping key is
 * `substr(COALESCE(taken_at, uploaded_at), 1, 7)` — format-safe because both an
 * ISO-8601 `taken_at` and SQLite's `datetime('now')` `uploaded_at` start `YYYY-MM`.
 * Each row carries the newest `thumbCount` photo ids for its thumb strip, picked
 * with a `ROW_NUMBER()` window function partitioned by month.
 */
export async function monthsSummary(
	db: D1Database,
	thumbCount = 6,
): Promise<MonthSummary[]> {
	// The capture date: EXIF taken_at when present, else the upload timestamp.
	const captured = "COALESCE(e.taken_at, p.uploaded_at)";

	// Per-month counts, newest month first.
	const counts = await db
		.prepare(
			`SELECT substr(${captured}, 1, 7) AS month, COUNT(*) AS count
			 FROM photos p
			 LEFT JOIN exif_data e ON e.photo_id = p.id
			 WHERE p.deleted_at IS NULL
			 GROUP BY month
			 ORDER BY month DESC`,
		)
		.all<{ month: string; count: number }>();

	// Newest N photo ids per month via a window function, kept in newest-first
	// order so the thumb strip reads like the top of the gallery.
	const thumbs = await db
		.prepare(
			`SELECT month, id FROM (
				SELECT
					substr(${captured}, 1, 7) AS month,
					p.id AS id,
					ROW_NUMBER() OVER (
						PARTITION BY substr(${captured}, 1, 7)
						ORDER BY ${captured} DESC, p.id DESC
					) AS rn
				FROM photos p
				LEFT JOIN exif_data e ON e.photo_id = p.id
				WHERE p.deleted_at IS NULL
			)
			WHERE rn <= ?
			ORDER BY month DESC, rn ASC`,
		)
		.bind(thumbCount)
		.all<{ month: string; id: string }>();

	const byMonth = new Map<string, string[]>();
	for (const row of thumbs.results ?? []) {
		const list = byMonth.get(row.month) ?? [];
		list.push(row.id);
		byMonth.set(row.month, list);
	}

	return (counts.results ?? []).map((r) => ({
		month: r.month,
		count: r.count,
		thumbs: byMonth.get(r.month) ?? [],
	}));
}
