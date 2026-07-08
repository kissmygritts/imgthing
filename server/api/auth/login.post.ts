defineRouteMeta({
	openAPI: {
		tags: ["Auth"],
		summary: "Log in",
		description:
			"Exchange the single app passphrase for an HMAC-signed session cookie. A per-IP brute-force throttle runs *before* the passphrase compare; a locked-out IP is rejected with 429 and a `retry-after` header.",
		security: [],
		requestBody: {
			required: true,
			content: {
				"application/json": {
					schema: {
						type: "object",
						required: ["passphrase"],
						properties: {
							passphrase: { type: "string" },
						},
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Authenticated; sets the `imgthing_session` cookie.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: { ok: { type: "boolean" } },
						},
					},
				},
			},
			"401": { description: "Invalid passphrase." },
			"429": {
				description:
					"IP is locked out; see the `retry-after` header (seconds).",
			},
		},
	},
});

export default defineEventHandler(async (event) => {
	const db = useDB(event);
	const ip = clientIp(event);

	// Brute-force guard: a locked-out IP is rejected before the passphrase is
	// even read/compared, so lockout is uniform and cheap.
	const retry = await lockoutRetrySeconds(db, ip);
	if (retry > 0) {
		setHeader(event, "retry-after", retry);
		throw createError({
			statusCode: 429,
			statusMessage: "Too many attempts, try again later",
		});
	}

	const body = await readBody<{ passphrase?: string }>(event);
	const passphrase = body?.passphrase ?? "";

	if (!passphrase || !timingSafeEqual(passphrase, cf(event).APP_PASSPHRASE)) {
		await recordFailedLogin(db, ip);
		throw createError({ statusCode: 401, statusMessage: "Invalid passphrase" });
	}

	await clearLoginFailures(db, ip);
	await issueAuthCookie(event);
	return { ok: true };
});
