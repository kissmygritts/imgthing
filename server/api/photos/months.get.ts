// Months overview for the calendar view: one entry per month that has live
// photos, newest month first, each with a photo count and the newest few photo
// ids for its thumb strip. Owner-only via /api/** auth. Nitro routes this static
// `months` segment ahead of the dynamic `[id]`, so GET /api/photos/months lands
// here. The scoped gallery itself reuses GET /api/photos with from/to.
defineRouteMeta({
	openAPI: {
		tags: ["Photos"],
		summary: "Months overview",
		description:
			"One entry per month that has live (non-tombstoned) photos, newest month first. Each carries the photo count and the newest ~6 photo ids for the calendar's thumb strip. Grouping uses the capture date (EXIF taken_at, falling back to upload time).",
		security: [{ sessionCookie: [] }],
		responses: {
			"200": {
				description: "Months with photos, newest first.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							required: ["months"],
							properties: {
								months: {
									type: "array",
									items: {
										type: "object",
										required: ["month", "count", "thumbs"],
										properties: {
											month: {
												type: "string",
												description: 'Capture month, "YYYY-MM".',
											},
											count: { type: "integer" },
											thumbs: {
												type: "array",
												items: { type: "string" },
												description:
													"Newest-first photo ids for the thumb strip.",
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	},
});

export default defineEventHandler(async (event) => {
	const months = await monthsSummary(useDB(event));
	return { months };
});
