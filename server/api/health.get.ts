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
