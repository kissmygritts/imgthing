-- Per-IP login throttling. POST /api/auth/login has a single passphrase and no
-- lockout, so once public it is an open guessing target. This table records
-- consecutive failures per client IP (CF-Connecting-IP); after a free allowance
-- it locks the IP out with exponential backoff. A successful login deletes the
-- row (reset). Rows for IPs that never lock stay tiny and are self-limiting.

CREATE TABLE login_attempts (
    ip           TEXT PRIMARY KEY,
    fail_count   INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT               -- ISO datetime (UTC); NULL = not locked
);
