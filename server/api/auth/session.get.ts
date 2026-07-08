defineRouteMeta({
	openAPI: {
		tags: ["Auth"],
		summary: "Get session status",
		description:
			"Report whether the current request carries a valid session cookie.",
		security: [],
		responses: {
			"200": {
				description: "Session status.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: { loggedIn: { type: "boolean" } },
						},
					},
				},
			},
		},
	},
});

export default defineEventHandler(async (event) => {
	const session = await getAuthSession(event);
	return { loggedIn: !!session };
});
