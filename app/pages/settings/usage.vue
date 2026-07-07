<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { humanBytes } from "@/lib/utils";

interface Usage {
	count: number;
	originalBytes: number;
	variantBytes: number;
	variantBytesComplete: boolean;
	trashedCount: number;
	trashedBytes: number;
	totalBytes: number;
	tables: {
		photos: number;
		exif_data: number;
		folders: number;
		tags: number;
		folder_photos: number;
		photo_tags: number;
	};
	cost: {
		r2StorageUsdPerGbMonth: number;
		estimatedMonthlyUsd: number;
	};
}

// Cookie-forwarding fetch so the auth-guarded endpoint resolves during SSR.
const requestFetch = useRequestFetch();
const { data } = await useAsyncData("settings-usage", () =>
	requestFetch<Usage>("/api/settings/usage"),
);

const tableRows = computed(() => {
	const t = data.value?.tables;
	if (!t) return [];
	return [
		{ label: "photos", count: t.photos },
		{ label: "exif_data", count: t.exif_data },
		{ label: "folders", count: t.folders },
		{ label: "tags", count: t.tags },
		{ label: "folder_photos", count: t.folder_photos },
		{ label: "photo_tags", count: t.photo_tags },
	];
});

const usdFmt = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});
</script>

<template>
	<div v-if="data" class="flex flex-col gap-4">
		<!-- Headline stat cards. Wrap to one column at phone width. -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<Card>
				<CardHeader class="gap-1">
					<CardDescription>Photos</CardDescription>
					<CardTitle class="text-3xl tabular-nums">{{ data.count }}</CardTitle>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader class="gap-1">
					<CardDescription>Total stored</CardDescription>
					<CardTitle class="text-3xl tabular-nums">
						{{ humanBytes(data.totalBytes) }}
					</CardTitle>
					<Badge v-if="!data.variantBytesComplete" variant="secondary">
						Partial — some variants untracked
					</Badge>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader class="gap-1">
					<CardDescription>Est. R2 storage / month</CardDescription>
					<CardTitle class="text-3xl tabular-nums">
						{{ usdFmt.format(data.cost.estimatedMonthlyUsd) }}
					</CardTitle>
					<Badge variant="outline">Estimate</Badge>
				</CardHeader>
			</Card>
		</div>

		<!-- Byte breakdown. -->
		<Card>
			<CardHeader>
				<CardTitle>Storage breakdown</CardTitle>
				<CardDescription>
					Originals plus the three precomputed WebP variants per photo.
				</CardDescription>
			</CardHeader>
			<CardContent class="flex flex-col gap-2 text-sm">
				<div class="flex items-center justify-between gap-4">
					<span class="text-muted-foreground">Originals ({{ data.count }})</span>
					<span class="tabular-nums">{{ humanBytes(data.originalBytes) }}</span>
				</div>
				<div class="flex items-center justify-between gap-4">
					<span class="text-muted-foreground">
						Variants
						<span v-if="!data.variantBytesComplete">(partial)</span>
					</span>
					<span class="tabular-nums">{{ humanBytes(data.variantBytes) }}</span>
				</div>
				<div class="flex items-center justify-between gap-4">
					<span class="text-muted-foreground">
						Trash ({{ data.trashedCount }}, reclaimable)
					</span>
					<span class="tabular-nums">{{ humanBytes(data.trashedBytes) }}</span>
				</div>
				<div
					class="mt-1 flex items-center justify-between gap-4 border-t pt-2 font-medium"
				>
					<span>Total</span>
					<span class="tabular-nums">{{ humanBytes(data.totalBytes) }}</span>
				</div>
			</CardContent>
		</Card>

		<!-- Per-table D1 row counts. -->
		<Card>
			<CardHeader>
				<CardTitle>Database rows</CardTitle>
				<CardDescription>Row counts per D1 table.</CardDescription>
			</CardHeader>
			<CardContent class="flex flex-col gap-2 text-sm">
				<div
					v-for="row in tableRows"
					:key="row.label"
					class="flex items-center justify-between gap-4"
				>
					<span class="font-mono text-muted-foreground">{{ row.label }}</span>
					<span class="tabular-nums">{{ row.count }}</span>
				</div>
			</CardContent>
		</Card>
	</div>
</template>
