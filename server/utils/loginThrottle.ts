import type { H3Event } from "h3";

// Per-IP brute-force protection for the single-passphrase login. The first
// FREE_ATTEMPTS consecutive failures from an IP are allowed with no delay; after
// that each failure locks the IP for an exponentially growing window, capped at
// LOCK_CAP_SEC. A successful login clears the IP's row. Time authority lives in
// D1 (`datetime('now')`) so there's no Worker/DB clock-skew or Date.now() reliance.
const FREE_ATTEMPTS = 5;
const LOCK_BASE_SEC = 60; // first lock after the free allowance = 1 min
const LOCK_CAP_SEC = 3600; // ceiling = 1 hour

/**
 * The client IP for throttling. On Cloudflare, `CF-Connecting-IP` is set by the
 * edge and cannot be spoofed; fall back to the first `X-Forwarded-For` hop and
 * then to a shared "unknown" bucket (local dev / tests with no edge headers).
 */
export function clientIp(event: H3Event): string {
	const cf = getRequestHeader(event, "cf-connecting-ip");
	if (cf) return cf;
	const xff = getRequestHeader(event, "x-forwarded-for");
	if (xff) return xff.split(",")[0]?.trim() || "unknown";
	return "unknown";
}

function backoffSeconds(failCount: number): number {
	const over = failCount - FREE_ATTEMPTS; // 1, 2, 3, ... once past the allowance
	if (over < 1) return 0;
	return Math.min(LOCK_BASE_SEC * 2 ** (over - 1), LOCK_CAP_SEC);
}

/**
 * If the IP is currently locked out, the number of seconds until it unlocks
 * (always ≥ 1); otherwise 0. Checked before comparing the passphrase, so a
 * locked IP never reaches the compare.
 */
export async function lockoutRetrySeconds(
	db: D1Database,
	ip: string,
): Promise<number> {
	const row = await db
		.prepare(
			`SELECT CAST(strftime('%s', locked_until) AS INTEGER)
			      - CAST(strftime('%s', 'now') AS INTEGER) AS retry
			 FROM login_attempts
			 WHERE ip = ? AND locked_until IS NOT NULL AND locked_until > datetime('now')`,
		)
		.bind(ip)
		.first<{ retry: number }>();
	if (!row) return 0;
	return Math.max(1, row.retry);
}

/** Increment the IP's consecutive-failure count and (re)arm the lockout window. */
export async function recordFailedLogin(
	db: D1Database,
	ip: string,
): Promise<void> {
	const row = await db
		.prepare(
			`INSERT INTO login_attempts (ip, fail_count) VALUES (?, 1)
			 ON CONFLICT(ip) DO UPDATE SET fail_count = fail_count + 1
			 RETURNING fail_count`,
		)
		.bind(ip)
		.first<{ fail_count: number }>();

	const seconds = backoffSeconds(row?.fail_count ?? 1);
	if (seconds > 0) {
		await db
			.prepare(
				`UPDATE login_attempts SET locked_until = datetime('now', ?) WHERE ip = ?`,
			)
			.bind(`+${seconds} seconds`, ip)
			.run();
	}
}

/** Clear an IP's failure record after a successful login. */
export async function clearLoginFailures(
	db: D1Database,
	ip: string,
): Promise<void> {
	await db.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
}
