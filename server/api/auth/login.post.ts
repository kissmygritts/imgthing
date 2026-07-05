export default defineEventHandler(async (event) => {
	const body = await readBody<{ passphrase?: string }>(event);
	const passphrase = body?.passphrase ?? "";

	if (!passphrase || !timingSafeEqual(passphrase, cf(event).APP_PASSPHRASE)) {
		throw createError({ statusCode: 401, statusMessage: "Invalid passphrase" });
	}

	await issueAuthCookie(event);
	return { ok: true };
});
