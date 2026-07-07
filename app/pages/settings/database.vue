<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

// Read-only inspector over the owner's D1 tables. Server-side allow-list gates the
// table name; this page just mirrors that list, pages through rows, and truncates
// obviously-large cells (blobs, tokens) for legibility. Single-owner app.

interface TableData {
	table: string;
	columns: string[];
	rows: Record<string, unknown>[];
	total: number;
	limit: number;
	offset: number;
}

// Must match ALLOWED_TABLES in server/api/settings/db/[table].get.ts.
const TABLES = [
	"photos",
	"exif_data",
	"folders",
	"tags",
	"folder_photos",
	"photo_tags",
] as const;

const PAGE_SIZE = 50;

const table = ref<(typeof TABLES)[number]>("photos");
const offset = ref(0);

const requestFetch = useRequestFetch();
const { data, pending } = await useAsyncData<TableData>(
	"settings-db",
	() =>
		requestFetch<TableData>(`/api/settings/db/${table.value}`, {
			query: { limit: PAGE_SIZE, offset: offset.value },
		}),
	{ watch: [table, offset] },
);

function selectTable(t: (typeof TABLES)[number]) {
	if (t === table.value) return;
	offset.value = 0;
	table.value = t;
}

const total = computed(() => data.value?.total ?? 0);
const from = computed(() => (total.value === 0 ? 0 : offset.value + 1));
const to = computed(() =>
	Math.min(offset.value + (data.value?.rows.length ?? 0), total.value),
);
const canPrev = computed(() => offset.value > 0);
const canNext = computed(() => offset.value + PAGE_SIZE < total.value);

function prev() {
	if (canPrev.value) offset.value = Math.max(0, offset.value - PAGE_SIZE);
}
function next() {
	if (canNext.value) offset.value += PAGE_SIZE;
}

// Render a cell: NULLs read as a dim placeholder, long strings truncate so blobs
// (exif_data.other_data) and tokens stay one line. Owner-only inspection, not a
// security boundary — bytes are already visible to the owner elsewhere.
const MAX_CELL = 80;
function cellText(value: unknown): string {
	if (value === null || value === undefined) return "";
	const s = typeof value === "object" ? JSON.stringify(value) : String(value);
	return s.length > MAX_CELL ? `${s.slice(0, MAX_CELL)}…` : s;
}
function isNull(value: unknown): boolean {
	return value === null || value === undefined;
}
</script>

<template>
	<div class="flex flex-col gap-4">
		<!-- Table selector: pill buttons over the allow-list. Wraps at phone width. -->
		<div class="flex flex-wrap gap-2" role="group" aria-label="Select a table">
			<Button
				v-for="t in TABLES"
				:key="t"
				size="sm"
				:variant="t === table ? 'default' : 'outline'"
				class="font-mono"
				@click="selectTable(t)"
			>
				{{ t }}
			</Button>
		</div>

		<Card>
			<CardHeader class="gap-1">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<CardTitle class="font-mono">{{ table }}</CardTitle>
					<Badge variant="secondary">Read-only</Badge>
				</div>
				<CardDescription>
					<span class="tabular-nums">{{ total }}</span> row{{
						total === 1 ? "" : "s"
					}}. Showing
					<span class="tabular-nums">{{ from }}</span>–<span
						class="tabular-nums"
						>{{ to }}</span
					>.
				</CardDescription>
			</CardHeader>

			<CardContent class="flex flex-col gap-4">
				<!-- Wide tables scroll inside this box; the page body never overflows. -->
				<div class="overflow-x-auto rounded-md border">
					<table class="w-full border-collapse text-left text-sm">
						<thead>
							<tr class="border-b bg-muted/50">
								<th
									v-for="col in data?.columns ?? []"
									:key="col"
									class="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-muted-foreground"
								>
									{{ col }}
								</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="(row, i) in data?.rows ?? []"
								:key="i"
								class="border-b last:border-0 hover:bg-muted/30"
							>
								<td
									v-for="col in data?.columns ?? []"
									:key="col"
									class="max-w-[22rem] truncate whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums"
									:title="isNull(row[col]) ? 'NULL' : String(row[col])"
								>
									<span v-if="isNull(row[col])" class="italic text-muted-foreground/60">
										NULL
									</span>
									<span v-else>{{ cellText(row[col]) }}</span>
								</td>
							</tr>
							<tr v-if="!pending && (data?.rows.length ?? 0) === 0">
								<td
									:colspan="Math.max(1, data?.columns.length ?? 1)"
									class="px-3 py-6 text-center text-sm text-muted-foreground"
								>
									No rows.
								</td>
							</tr>
						</tbody>
					</table>
				</div>

				<!-- Prev / next paging. -->
				<div class="flex items-center justify-between gap-2">
					<span class="text-xs text-muted-foreground tabular-nums">
						{{ from }}–{{ to }} of {{ total }}
					</span>
					<div class="flex gap-2">
						<Button
							size="sm"
							variant="outline"
							:disabled="!canPrev || pending"
							@click="prev"
						>
							Prev
						</Button>
						<Button
							size="sm"
							variant="outline"
							:disabled="!canNext || pending"
							@click="next"
						>
							Next
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	</div>
</template>
