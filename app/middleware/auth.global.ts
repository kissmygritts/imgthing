// Redirects unauthenticated visitors to /login for every page except /login.
// The API is independently guarded by server/middleware/auth.ts.
export default defineNuxtRouteMiddleware(async (to) => {
	if (to.path === "/login") return;

	const request = useRequestFetch();
	const { loggedIn } = await request("/api/auth/session");
	if (!loggedIn) {
		return navigateTo("/login");
	}
});
