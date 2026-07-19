// Redirects unauthenticated visitors to /login for every page except /login.
// The API is independently guarded by server/middleware/auth.ts.
export default defineNuxtRouteMiddleware(async (to) => {
	if (to.path === "/login") return;
	// Public folder galleries (/f/{slug}) are unauthenticated by design — the
	// folder token in the query is the only credential. Never redirect to /login.
	if (to.path.startsWith("/f/")) return;

	const request = useRequestFetch();
	const { loggedIn } = await request("/api/auth/session");
	if (!loggedIn) {
		return navigateTo("/login");
	}
});
