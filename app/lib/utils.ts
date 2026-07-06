import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Format a byte count as a compact human string (B / KB / MB / GB / TB) using
// binary (1024) units. One decimal for KB and up, none for raw bytes.
export function humanBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1,
	);
	const value = bytes / 1024 ** i;
	return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}
