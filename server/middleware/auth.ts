// Guards the API surface: everything under /api/ requires a valid session,
// except the auth endpoints themselves and the health check.
const PUBLIC_API = ["/api/auth/", "/api/health"];

export default defineEventHandler(async (event) => {
	const path = event.path.split("?")[0];
	if (!path.startsWith("/api/")) return;
	if (PUBLIC_API.some((p) => path === p || path.startsWith(p))) return;

	const session = await getAuthSession(event);
	if (!session) {
		throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
	}
	event.context.session = session;
});
