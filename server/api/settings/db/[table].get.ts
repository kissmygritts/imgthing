// Read-only, owner-only raw D1 table viewer (session-gated via server/middleware/auth.ts).
// GET only — no mutations. Returns { table, columns, rows, total } for a paged slice.
//
// SECURITY CRUX: the table name is only ever interpolated into SQL AFTER confirming
// membership in ALLOWED_TABLES. Anything else — including login_attempts (holds IPs),
// sqlite_master, or a bogus name — is rejected with a bare 404. There is no raw-SQL
// input path: the sole free-form input is the table name, which is allow-list gated,
// and PRAGMA table_info() is likewise only called with an allow-listed name.
//
// login_attempts is deliberately EXCLUDED from the allow-list (contains client IPs).
const ALLOWED_TABLES = new Set([
	"photos",
	"exif_data",
	"folders",
	"tags",
	"folder_photos",
	"photo_tags",
]);

export default defineEventHandler(async (event) => {
	const table = getRouterParam(event, "table");
	// Reject any non-allow-listed table with a uniform 404 before touching SQL.
	if (!table || !ALLOWED_TABLES.has(table)) {
		throw createError({ statusCode: 404, statusMessage: "Not found" });
	}

	const q = getQuery(event);
	// Mirror photos/index.get.ts:114-115 — clamp limit to 1..200 (default 50).
	const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
	const offset = Math.max(Number(q.offset) || 0, 0);

	const db = useDB(event);

	// Column discovery via PRAGMA so empty tables still render headers. `table` is
	// allow-list-gated above; PRAGMA cannot be parameterized, hence the guard.
	const { results: pragma } = await db
		.prepare(`PRAGMA table_info(${table})`)
		.all<{ name: string }>();
	const columns = (pragma ?? []).map((c) => c.name);

	const countRow = await db
		.prepare(`SELECT COUNT(*) AS total FROM ${table}`)
		.first<{ total: number }>();

	const { results } = await db
		.prepare(`SELECT * FROM ${table} LIMIT ? OFFSET ?`)
		.bind(limit, offset)
		.all();

	return {
		table,
		columns,
		rows: results ?? [],
		total: countRow?.total ?? 0,
		limit,
		offset,
	};
});
