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
