// Create a tag by name. Names are unique (case-insensitive), so this is
// idempotent: creating a tag that already exists returns the existing row
// rather than erroring.
export default defineEventHandler(async (event) => {
	const body = await readBody<{ name?: unknown }>(event);
	const name = typeof body?.name === "string" ? body.name.trim() : "";
	if (!name) {
		throw createError({ statusCode: 400, statusMessage: "Name is required" });
	}

	const db = useDB(event);
	const existing = await db
		.prepare("SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE")
		.bind(name)
		.first<{ id: string; name: string }>();
	if (existing) return existing;

	const id = crypto.randomUUID();
	await db
		.prepare("INSERT INTO tags (id, name) VALUES (?, ?)")
		.bind(id, name)
		.run();
	return { id, name };
});
