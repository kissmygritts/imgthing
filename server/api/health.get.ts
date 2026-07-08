defineRouteMeta({
	openAPI: {
		tags: ["System"],
		summary: "Health check",
		description:
			"Unauthenticated liveness probe. Reports which Cloudflare bindings resolved: D1 (`DB`), R2 (`BUCKET`), and Images (`IMAGES`).",
		security: [],
		responses: {
			"200": {
				description: "Service is up; per-binding resolution flags.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							required: ["ok", "bindings"],
							properties: {
								ok: { type: "boolean" },
								bindings: {
									type: "object",
									properties: {
										DB: { type: "boolean" },
										BUCKET: { type: "boolean" },
										IMAGES: { type: "boolean" },
									},
								},
							},
						},
					},
				},
			},
		},
		// One-time global: the session cookie every gated /api/** route requires.
		// Defined here (on the always-present health route) and referenced by each
		// gated route via `security: [{ sessionCookie: [] }]`.
		$global: {
			components: {
				securitySchemes: {
					sessionCookie: {
						type: "apiKey",
						in: "cookie",
						name: "imgthing_session",
						description:
							"HMAC-signed stateless session cookie issued by POST /api/auth/login. Required by all /api/** routes except /api/auth/* and /api/health.",
					},
				},
			},
		},
	},
});

export default defineEventHandler(async (event) => {
	const env = cf(event);

	let db = false;
	try {
		await env.DB.prepare("SELECT 1").first();
		db = true;
	} catch {
		db = false;
	}

	return {
		ok: true,
		bindings: {
			DB: db,
			BUCKET: typeof env.BUCKET?.get === "function",
			IMAGES: typeof env.IMAGES?.input === "function",
		},
	};
});
