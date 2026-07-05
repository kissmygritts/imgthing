// Shared helpers for the unauthenticated public-serving routes under
// server/routes/p/**.
//
// SECURITY: these routes must return a real, uniform HTTP 404 on every failure.
// Throwing createError() here is NOT enough — for non-/api routes Nitro/Nuxt
// catches the thrown error and renders the SPA/error HTML shell with a 200, which
// both breaks the uniform-404 contract (a revoked token would look "alive") and
// leaks the app HTML. Returning a bare Response bypasses that renderer entirely,
// yielding a clean 404 with no body of interest and no id/r2_key ever exposed.
export function publicNotFound(): Response {
	return new Response("Not found", { status: 404 });
}
