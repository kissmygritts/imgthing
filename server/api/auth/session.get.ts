export default defineEventHandler(async (event) => {
	const session = await getAuthSession(event);
	return { loggedIn: !!session };
});
