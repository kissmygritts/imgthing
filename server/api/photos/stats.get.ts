// Storage-usage readout (owner-only via /api/** auth). Aggregates the library's
// live count + summed bytes (trash excluded), plus a separate figure for the
// tombstoned rows so the user can see what emptying the Trash would reclaim.
// No r2_key, no per-photo data. Nitro routes this static `stats` segment ahead
// of the dynamic `[id]`, so GET /api/photos/stats lands here.
export default defineEventHandler(async (event) => {
	const db = useDB(event);

	const live = await db
		.prepare(
			`SELECT COUNT(*) AS count, COALESCE(SUM(file_size), 0) AS totalBytes
			 FROM photos WHERE deleted_at IS NULL`,
		)
		.first<{ count: number; totalBytes: number }>();

	const trashed = await db
		.prepare(
			`SELECT COUNT(*) AS trashedCount, COALESCE(SUM(file_size), 0) AS trashedBytes
			 FROM photos WHERE deleted_at IS NOT NULL`,
		)
		.first<{ trashedCount: number; trashedBytes: number }>();

	return {
		count: live?.count ?? 0,
		totalBytes: live?.totalBytes ?? 0,
		trashedCount: trashed?.trashedCount ?? 0,
		trashedBytes: trashed?.trashedBytes ?? 0,
	};
});
