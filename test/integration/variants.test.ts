import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import { generateVariants } from "../../server/utils/variants";

// Regression guard for the "letterboxed thumbnail" bug: passing both width and
// height to the Images transform pads the output to an N×N black box, which shows
// as black bars under the grid's object-cover. generateVariants must bound only
// the longest side, preserving the original aspect ratio at every size.

// Solid PNGs with known aspect ratios (see scripts in git history / plan notes).
const LANDSCAPE_200x100 =
	"iVBORw0KGgoAAAANSUhEUgAAAMgAAABkCAIAAABM5OhcAAAAzElEQVR42u3SMQ0AAAzDsAIrfxQDMxI7dlgygiiZFs5FAoyFsTAWGAtjYSwwFsbCWGAsjIWxwFgYC2OBsTAWxgJjYSyMBcbCWBgLjIWxMBYYC2NhLDAWxsJYYCyMhbHAWBgLY4GxMBbGAmNhLIwFxsJYGAuMhbEwFhgLY2EsMBbGwlhgLIyFscBYGAtjgbEwFsYCY2EsjAXGwlgYC4yFsTAWGAtjYSwwFsbCWGAsjIWxwFgYC2NhLBUwFsbCWGAsjIWxwFgYC2OBsfhtAYasyIoRxYOrAAAAAElFTkSuQmCC";
const PORTRAIT_100x200 =
	"iVBORw0KGgoAAAANSUhEUgAAAGQAAADICAIAAACRXtOWAAABJElEQVR42u3QAQ0AAAgDoAczmBGNZYUHYCMBmT1KUSBLlixZsmQpkCVLlixZshTIkiVLlixZCmTJkiVLliwFsmTJkiVLlgJZsmTJkiVLgSxZsmTJkqVAlixZsmTJUiBLlixZsmQpkCVLlixZshTIkiVLlixZCmTJkiVLliwFsmTJkiVLlgJZsmTJkiVLgSxZsmTJkqVAlixZsmTJUiBLlixZsmQpkCVLlixZshTIkiVLlixZCmTJkiVLliwFsmTJkiVLlgJZsmTJkiVLgSxZsmTJkqVAlixZsmTJUiBLlixZsmQpkCVLlixZshTIkiVLlixZCmTJkiVLliwFsmTJkiVLlgJZsmTJkiVLgSxZsmTJkqVAlixZsmTJUiBLlixZsmQp6D3jW/4+GqHAXAAAAABJRU5ErkJggg==";

function bytes(b64: string): ArrayBuffer {
	return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}

const images = env.IMAGES as unknown as ImagesBinding;
const bucket = env.BUCKET as unknown as R2Bucket;

async function dims(key: string): Promise<{ width: number; height: number }> {
	const obj = await bucket.get(key);
	expect(obj, `${key} should exist`).toBeTruthy();
	const info = await images.info((obj as R2ObjectBody).body);
	if (!("width" in info)) throw new Error("no pixel dims");
	return { width: info.width, height: info.height };
}

describe("variant generation preserves aspect ratio (no square padding)", () => {
	test("landscape input stays landscape at every size", async () => {
		await generateVariants(images, bucket, "land", bytes(LANDSCAPE_200x100));
		for (const [size, longest] of [
			["thumb", 800],
			["md", 1280],
			["lg", 2560],
		] as const) {
			const { width, height } = await dims(`variants/land/${size}`);
			expect(width).toBe(longest); // longest side bounded to the tier
			expect(width).toBeGreaterThan(height); // not padded to a square
			expect(height).toBe(longest / 2); // 2:1 aspect preserved
		}
	});

	test("portrait input stays portrait at every size", async () => {
		await generateVariants(images, bucket, "port", bytes(PORTRAIT_100x200));
		for (const [size, longest] of [
			["thumb", 800],
			["md", 1280],
			["lg", 2560],
		] as const) {
			const { width, height } = await dims(`variants/port/${size}`);
			expect(height).toBe(longest); // longest side (height) bounded
			expect(height).toBeGreaterThan(width); // not padded to a square
			expect(width).toBe(longest / 2); // 1:2 aspect preserved
		}
	});
});
