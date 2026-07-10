<script setup lang="ts">
import { CalendarDays, ChevronRight } from "@lucide/vue";
import { monthLabel } from "@/lib/date";

// The calendar view: a date-first navigation surface. It renders the months
// overview — one month row per month that has live photos, newest first, each
// carrying the month label, a photo count, and a short thumb strip. Tapping a
// row enters the gallery scoped to that month (selectMonth → listQuery from/to).
// Two levels only: months overview → the existing All-photos grid.

interface MonthSummary {
	month: string; // "YYYY-MM"
	count: number;
	thumbs: string[]; // newest-first photo ids for the strip
}

const { selectMonth } = useLibrary();

useHead({ title: "Calendar · imgthing" });

// Months are the page's primary (SSR-critical) content, so fetch + await here.
// useRequestFetch forwards the incoming cookies during SSR so the auth-guarded
// endpoint doesn't 401 and render an empty overview.
const requestFetch = useRequestFetch();
const { data } = await useAsyncData("months", () =>
	requestFetch<{ months: MonthSummary[] }>("/api/photos/months"),
);
const months = computed(() => data.value?.months ?? []);

const totalPhotos = computed(() =>
	months.value.reduce((sum, m) => sum + m.count, 0),
);

const fmt = (n: number) => n.toLocaleString();
</script>

<template>
	<div class="flex flex-1 flex-col gap-6">
		<header
			class="flex items-end justify-between gap-4 border-b border-border pb-5"
		>
			<div class="min-w-0">
				<h1
					class="truncate font-serif text-3xl font-normal tracking-tight text-foreground"
				>
					Calendar
				</h1>
				<p class="mt-1 text-sm tabular-nums text-muted-foreground">
					<template v-if="months.length">
						{{ months.length }} month{{ months.length === 1 ? "" : "s" }} ·
						{{ fmt(totalPhotos) }} photo{{ totalPhotos === 1 ? "" : "s" }}
					</template>
					<template v-else>Your library by month</template>
				</p>
			</div>
		</header>

		<!-- Months overview. Rows sit directly on the glass panel — no filled card —
		     so the frosted surface reads through. A faint tint appears only on hover. -->
		<div v-if="months.length" class="flex flex-col gap-1">
			<button
				v-for="m in months"
				:key="m.month"
				type="button"
				class="group relative flex cursor-pointer items-start gap-4 rounded-2xl p-3 text-left ring-1 ring-transparent transition duration-200 hover:bg-primary/[0.03] hover:shadow-[0_7px_20px_-12px_color-mix(in_oklab,var(--primary)_38%,transparent)] hover:ring-primary/20 sm:gap-5"
				:aria-label="`Open ${monthLabel(m.month)}, ${m.count} photos`"
				@click="selectMonth(m.month)"
			>
				<!-- month label + count, top-aligned with the thumb strip -->
				<div class="w-24 shrink-0 sm:w-40">
					<div
						class="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg"
					>
						{{ monthLabel(m.month) }}
					</div>
					<div class="mt-0.5 text-xs tabular-nums text-muted-foreground">
						{{ fmt(m.count) }} photo{{ m.count === 1 ? "" : "s" }}
					</div>
				</div>

				<!-- thumb strip: fixed-size thumbnails so every row is the same height,
				     in a horizontal scroller so all of the month's newest thumbnails are
				     reachable. Hard edge (no fade); the scrollbar is hidden. -->
				<div
					class="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					<div
						v-for="id in m.thumbs"
						:key="id"
						class="relative size-48 shrink-0 overflow-hidden rounded-2xl"
					>
						<img
							:src="`/api/photos/${id}/variant?size=thumb`"
							alt=""
							loading="lazy"
							decoding="async"
							class="size-full object-cover"
						/>
						<span
							class="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
						/>
					</div>
				</div>

				<ChevronRight
					class="mt-1 hidden size-5 shrink-0 self-start text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block"
				/>
			</button>
		</div>

		<!-- Empty state: no photos in the library yet -->
		<div
			v-else
			class="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center"
		>
			<CalendarDays class="size-10 text-muted-foreground/60" />
			<div>
				<p class="font-medium text-foreground">No photos yet</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Upload some photos and your months will show up here.
				</p>
			</div>
			<NuxtLink
				to="/upload"
				class="mt-1 rounded-full bg-gradient-to-b from-primary to-[#5a41b8] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-transform hover:-translate-y-px"
			>
				Upload photos
			</NuxtLink>
		</div>
	</div>
</template>
