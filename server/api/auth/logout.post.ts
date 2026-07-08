defineRouteMeta({
	openAPI: {
		tags: ["Auth"],
		summary: "Log out",
		description: "Clear the session cookie, ending the current session.",
		security: [],
		responses: {
			"200": {
				description: "Session cookie cleared.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: { ok: { type: "boolean" } },
						},
					},
				},
			},
		},
	},
});

export default defineEventHandler((event) => {
	clearAuthCookie(event);
	return { ok: true };
});
