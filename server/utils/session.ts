import type { H3Event } from "h3";

const COOKIE_NAME = "imgthing_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
const encoder = new TextEncoder();

interface SessionPayload {
	sub: string;
	exp: number; // epoch ms
}

function b64urlFromBytes(bytes: ArrayBuffer | Uint8Array): string {
	const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let bin = "";
	for (const b of arr) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromB64url(str: string): Uint8Array {
	const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

async function signToken(
	secret: string,
	payload: SessionPayload,
): Promise<string> {
	const data = b64urlFromBytes(encoder.encode(JSON.stringify(payload)));
	const sig = await crypto.subtle.sign(
		"HMAC",
		await hmacKey(secret),
		encoder.encode(data),
	);
	return `${data}.${b64urlFromBytes(sig)}`;
}

async function verifyToken(
	secret: string,
	token: string,
): Promise<SessionPayload | null> {
	const [data, sig] = token.split(".");
	if (!data || !sig) return null;
	const ok = await crypto.subtle.verify(
		"HMAC",
		await hmacKey(secret),
		bytesFromB64url(sig),
		encoder.encode(data),
	);
	if (!ok) return null;
	try {
		const payload = JSON.parse(
			new TextDecoder().decode(bytesFromB64url(data)),
		) as SessionPayload;
		if (typeof payload.exp !== "number" || payload.exp < Date.now())
			return null;
		return payload;
	} catch {
		return null;
	}
}

/** Constant-time string comparison, resistant to timing attacks. */
export function timingSafeEqual(a: string, b: string): boolean {
	const ab = encoder.encode(a);
	const bb = encoder.encode(b);
	// Always compare a fixed number of bytes to avoid leaking length.
	let mismatch = ab.length ^ bb.length;
	for (let i = 0; i < ab.length; i++) {
		mismatch |= ab[i] ^ (bb[i] ?? 0);
	}
	return mismatch === 0;
}

/** Read and validate the session from the request cookie. */
export async function getAuthSession(
	event: H3Event,
): Promise<SessionPayload | null> {
	const token = getCookie(event, COOKIE_NAME);
	if (!token) return null;
	return verifyToken(cf(event).SESSION_SECRET, token);
}

/** Issue a fresh signed session cookie for the owner. */
export async function issueAuthCookie(event: H3Event): Promise<void> {
	const token = await signToken(cf(event).SESSION_SECRET, {
		sub: "owner",
		exp: Date.now() + MAX_AGE_SEC * 1000,
	});
	setCookie(event, COOKIE_NAME, token, {
		httpOnly: true,
		secure: !import.meta.dev,
		sameSite: "lax",
		path: "/",
		maxAge: MAX_AGE_SEC,
	});
}

export function clearAuthCookie(event: H3Event): void {
	deleteCookie(event, COOKIE_NAME, { path: "/" });
}
