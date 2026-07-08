// Storage & cloud-usage readout (owner-only via /api/** auth). A richer sibling
// of /api/photos/stats: live count + original bytes, tracked variant bytes, trash
// reclaimable, per-table D1 row counts, and a labeled cost estimate.
//
// Variant bytes are the sum of photos.variant_bytes, recorded when generateVariants
// runs (upload + self-heal). Rows whose variants haven't been generated/healed yet
// stay NULL and contribute 0 — variantBytesComplete flags whether every live photo
// has a tracked figure so the UI can mark the total as possibly incomplete.

// Static per-GB-month estimate for R2 standard storage (USD). No live billing API.
const R2_STORAGE_USD_PER_GB_MONTH = 0.015;
const BYTES_PER_GB = 1024 ** 3;

defineRouteMeta({
	openAPI: {
		tags: ["Settings"],
		summary: "Get storage usage",
		description:
			"Storage & cloud-usage readout: live photo count + original bytes, tracked variant bytes, trash reclaimable, per-table D1 row counts, and a labeled (non-live) R2 cost estimate. `variantBytesComplete` is false when any live photo still lacks a tracked variant figure, meaning the totals are a floor.",
		security: [{ sessionCookie: [] }],
		responses: {
			"200": {
				description: "Usage and cost readout.",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								count: { type: "integer" },
								originalBytes: { type: "integer" },
								variantBytes: { type: "integer" },
								variantBytesComplete: { type: "boolean" },
								trashedCount: { type: "integer" },
								trashedBytes: { type: "integer" },
								totalBytes: { type: "integer" },
								tables: {
									type: "object",
									properties: {
										photos: { type: "integer" },
										exif_data: { type: "integer" },
										folders: { type: "integer" },
										tags: { type: "integer" },
										folder_photos: { type: "integer" },
										photo_tags: { type: "integer" },
									},
								},
								cost: {
									type: "object",
									properties: {
										r2StorageUsdPerGbMonth: { type: "number" },
										estimatedMonthlyUsd: { type: "number" },
									},
								},
							},
						},
					},
				},
			},
		},
	},
});

export default defineEventHandler(async (event) => {
	const db = useDB(event);

	const live = await db
		.prepare(
			`SELECT COUNT(*) AS count,
			        COALESCE(SUM(file_size), 0) AS originalBytes,
			        COALESCE(SUM(variant_bytes), 0) AS variantBytes,
			        COUNT(variant_bytes) AS variantTracked
			 FROM photos WHERE deleted_at IS NULL`,
		)
		.first<{
			count: number;
			originalBytes: number;
			variantBytes: number;
			variantTracked: number;
		}>();

	const trashed = await db
		.prepare(
			`SELECT COUNT(*) AS trashedCount, COALESCE(SUM(file_size), 0) AS trashedBytes
			 FROM photos WHERE deleted_at IS NOT NULL`,
		)
		.first<{ trashedCount: number; trashedBytes: number }>();

	// Cheap COUNT(*) per table in a single round-trip. Subqueries keep it one call.
	const rows = await db
		.prepare(
			`SELECT
			   (SELECT COUNT(*) FROM photos) AS photos,
			   (SELECT COUNT(*) FROM exif_data) AS exif_data,
			   (SELECT COUNT(*) FROM folders) AS folders,
			   (SELECT COUNT(*) FROM tags) AS tags,
			   (SELECT COUNT(*) FROM folder_photos) AS folder_photos,
			   (SELECT COUNT(*) FROM photo_tags) AS photo_tags`,
		)
		.first<{
			photos: number;
			exif_data: number;
			folders: number;
			tags: number;
			folder_photos: number;
			photo_tags: number;
		}>();

	const count = live?.count ?? 0;
	const originalBytes = live?.originalBytes ?? 0;
	const variantBytes = live?.variantBytes ?? 0;
	const variantTracked = live?.variantTracked ?? 0;
	const trashedBytes = trashed?.trashedBytes ?? 0;
	// True stored bytes = live originals + tracked live variants + trash originals.
	const totalBytes = originalBytes + variantBytes + trashedBytes;

	return {
		count,
		originalBytes,
		variantBytes,
		// False when any live photo still lacks a tracked variant figure — the
		// variant total (and thus totalBytes) is a floor, not the true size.
		variantBytesComplete: variantTracked >= count,
		trashedCount: trashed?.trashedCount ?? 0,
		trashedBytes,
		totalBytes,
		tables: {
			photos: rows?.photos ?? 0,
			exif_data: rows?.exif_data ?? 0,
			folders: rows?.folders ?? 0,
			tags: rows?.tags ?? 0,
			folder_photos: rows?.folder_photos ?? 0,
			photo_tags: rows?.photo_tags ?? 0,
		},
		cost: {
			// Labeled estimate only — no live billing API is queried.
			r2StorageUsdPerGbMonth: R2_STORAGE_USD_PER_GB_MONTH,
			estimatedMonthlyUsd:
				(totalBytes / BYTES_PER_GB) * R2_STORAGE_USD_PER_GB_MONTH,
		},
	};
});
