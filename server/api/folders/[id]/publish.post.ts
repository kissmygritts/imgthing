// Publish a folder as a public gallery. IDEMPOTENT: if the folder is already
// public, return its existing token — never rotate (a stable share link should
// not silently break). Deliberately diverges from the per-photo rotate-on-publish
// (photos rotate because show_location re-publishes; folders have no such
// per-publish setting). Returns the token plus the /f/{slug}?token= share link
// built from the request origin. Session-gated via server/middleware/auth.ts.
defineRouteMeta({
	openAPI: {
		tags: ["Folders"],
		summary: "Publish folder",
		description:
			"Publish a folder as a public gallery. Idempotent — if already public, returns the existing token (no rotation). Returns the token plus the fully-qualified `/f/{slug}?token=` share link. Session-gated.",
		security: [{ sessionCookie: [] }],
		parameters: [
			{ name: "id", in: "path", required: true, schema: { type: "string" } },
		],
		responses: {
			"200": {
				description: "The public token plus the fully-qualified share URL.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								token: { type: "string" },
								url: { type: "string" },
							},
						},
					},
				},
			},
			"404": { description: "Folder not found." },
		},
	},
});

// A cosmetic, URL-safe slug from the folder name (resolution is by token, so a
// stale slug still resolves; the pretty name is just for a friendly link).
function slugify(name: string): string {
	const s = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return s || "gallery";
}

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, "id") as string;
	const db = useDB(event);
	const folder = await requireFolder(db, id);

	// Idempotent: reuse the existing token when already public, else mint one.
	const existing = await db
		.prepare(
			"SELECT public_token FROM folders WHERE id = ? AND visibility = 'public'",
		)
		.bind(id)
		.first<{ public_token: string | null }>();

	let token = existing?.public_token ?? null;
	if (!token) {
		token = generatePublicToken();
		await db
			.prepare(
				`UPDATE folders
				 SET visibility = 'public', public_token = ?, published_at = datetime('now')
				 WHERE id = ?`,
			)
			.bind(token, id)
			.run();
	}

	const origin = getRequestURL(event).origin;
	return {
		token,
		url: `${origin}/f/${slugify(folder.name)}?token=${token}`,
	};
});
