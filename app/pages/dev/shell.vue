<script setup lang="ts">
import { Check, Globe, Heart } from "@lucide/vue";
import FiltersSheet from "@/components/FiltersSheet.vue";
import PhotoViewer, {
	type Photo,
	type Tag,
} from "@/components/PhotoViewer.vue";

// ── Dev-only shell harness ────────────────────────────────────────────────────
// A distraction-free stage for tuning the app *chrome* — the two-plane shell
// (aurora → translucent sidebar → floating glass panel), the sheets, and the
// detail panel — against representative content. It renders inside the REAL
// `default.vue` layout, so the aurora, `.glass-panel`, and the real `AppSidebar`
// are the production surfaces: anything you tune in `main.css` / `default.vue`
// reflects here live and ships automatically. Only the photo grid + the data fed
// to the sheets/viewer are mock. Light/dark is the sidebar's own ThemeToggle.
//
// Not linked anywhere; reach it at /dev/shell. Guarded to dev only.
if (!import.meta.dev) {
	throw createError({ statusCode: 404, statusMessage: "Not found" });
}

definePageMeta({ layout: "default" });
useHead({ title: "Shell harness · dev" });

// ── Mock content behind the glass ────────────────────────────────────────────
// Deterministic picsum seeds so tiles are stable between reloads. These are just
// backdrop — the subject under tuning is the chrome, not the tiles.
const SEEDS = [
	"orchid",
	"harbor",
	"dune",
	"frost",
	"ember",
	"lagoon",
	"quartz",
	"meadow",
	"cobalt",
	"amber",
	"slate",
	"peony",
];

function tileSrc(seed: string) {
	return `https://picsum.photos/seed/${seed}/600/600`;
}

const mockTags: Tag[] = [
	{ id: "t1", name: "Landscape" },
	{ id: "t2", name: "Portrait" },
	{ id: "t3", name: "Golden hour" },
];

const mockPhotos: Photo[] = SEEDS.map((seed, i) => ({
	id: seed,
	original_filename: `${seed}.jpg`,
	content_type: "image/jpeg",
	file_size: 3_200_000 + i * 210_000,
	uploaded_at: "2026-06-01T12:00:00Z",
	camera_make: "Fujifilm",
	camera_model: "X-T5",
	lens_info: "XF 35mm f/1.4 R",
	exposure: "1/250",
	aperture: "f/2.0",
	iso: 200,
	focal_length: "35mm",
	taken_at: "2026-05-28T18:42:00Z",
	gps_latitude: i % 3 === 0 ? 39.5296 : null,
	gps_longitude: i % 3 === 0 ? -119.8138 : null,
	width: 4000,
	height: 4000,
	folder_ids: null,
	tag_ids: i % 4 === 0 ? "t1,t3" : null,
	is_favorite: i % 5 === 0 ? 1 : 0,
	visibility: i % 6 === 0 ? "public" : "private",
	public_token: i % 6 === 0 ? "demo" : null,
	show_location: 0,
}));

// ── Harness-local UI state ────────────────────────────────────────────────────
const filtersOpen = ref(false);
const viewerOpen = ref(false);
const viewerIndex = ref(0);
const selectMode = ref(false);
const selected = ref<Set<string>>(new Set());

function toggleSelect(id: string) {
	const next = new Set(selected.value);
	next.has(id) ? next.delete(id) : next.add(id);
	selected.value = next;
}

function onTileClick(i: number, id: string) {
	if (selectMode.value) toggleSelect(id);
	else {
		viewerIndex.value = i;
		viewerOpen.value = true;
	}
}

// The New-folder dialog lives in AppSidebar, driven by useLibrary state — open it
// from here so the dialog surface is one click away too.
const { openCreate } = useLibrary();

// Toolbar/trigger chip recipe (root-plane glass chip, from the imgthing-ui skill).
const chip =
	"inline-flex items-center gap-2 rounded-full border border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 px-3.5 py-2 text-sm text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:text-foreground";
</script>

<template>
	<div class="flex w-full flex-1 flex-col gap-6">
		<header class="border-b border-border pb-5">
			<h1 class="font-serif text-3xl font-normal tracking-tight text-foreground">
				Shell harness
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Dev stage for tuning the shell — sidebar, glass panel, sheets, detail
				panel — against representative content. Chrome is the real layout; only
				the grid + sheet/viewer data are mock. Toggle light/dark from the sidebar
				footer; narrow the window under 768px to exercise the mobile sidebar
				sheet.
			</p>
		</header>

		<!-- Surface triggers (root-plane glass chips) -->
		<div class="flex flex-wrap items-center gap-2.5">
			<button type="button" :class="chip" @click="filtersOpen = true">
				Open Filters sheet
			</button>
			<button
				type="button"
				:class="chip"
				@click="viewerIndex = 0; viewerOpen = true"
			>
				Open detail panel
			</button>
			<button type="button" :class="chip" @click="openCreate(null)">
				Open New-folder dialog
			</button>
			<button
				type="button"
				:class="[
					chip,
					selectMode &&
						'!border-primary/40 !bg-primary/15 !text-accent-foreground',
				]"
				@click="selectMode = !selectMode; selected = new Set()"
			>
				{{ selectMode ? "Selecting…" : "Select mode" }}
			</button>
		</div>

		<!-- Representative grid — the real tile treatment (rounded-[20px], prism
		     edge, glass inset edge, favorite heart, selection ring/tint). -->
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			<figure
				v-for="(photo, i) in mockPhotos"
				:key="photo.id"
				class="group relative aspect-square overflow-hidden rounded-[20px] shadow-lg transition-transform duration-300 hover:-translate-y-1"
				:class="
					selected.has(photo.id) &&
						'ring-2 ring-primary ring-offset-2 ring-offset-background'
				"
			>
				<img
					:src="tileSrc(photo.id)"
					:alt="photo.original_filename"
					loading="lazy"
					class="absolute inset-0 size-full cursor-pointer object-cover"
					@click="onTileClick(i, photo.id)"
				/>

				<!-- selection tint -->
				<span
					v-if="selected.has(photo.id)"
					class="pointer-events-none absolute inset-0 z-[5] rounded-[20px] bg-primary/15"
				/>

				<!-- selection checkbox -->
				<button
					v-if="selectMode"
					type="button"
					class="absolute left-2 top-2 z-10 flex size-6 items-center justify-center rounded-full border shadow-sm transition"
					:class="
						selected.has(photo.id)
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-white/70 dark:border-white/12 bg-white/40 dark:bg-white/8 text-transparent backdrop-blur'
					"
					@click.stop="toggleSelect(photo.id)"
				>
					<Check class="size-3.5" />
				</button>

				<!-- favorite heart -->
				<button
					v-if="!selectMode"
					type="button"
					class="absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border border-white/70 dark:border-white/12 bg-white/40 dark:bg-white/8 backdrop-blur transition hover:bg-white/60 dark:hover:bg-white/15"
					:class="
						photo.is_favorite
							? 'text-rose-500 opacity-100'
							: 'text-white opacity-0 group-hover:opacity-100'
					"
					@click.stop="photo.is_favorite = photo.is_favorite ? 0 : 1"
				>
					<Heart class="size-4" :class="photo.is_favorite ? 'fill-current' : ''" />
				</button>

				<!-- public indicator -->
				<span
					v-if="photo.visibility === 'public'"
					class="pointer-events-none absolute bottom-2 right-2 z-10 flex size-6 items-center justify-center rounded-full border border-white/70 dark:border-white/12 bg-white/40 dark:bg-white/8 text-white backdrop-blur"
					title="Public"
				>
					<Globe class="size-3.5" />
				</span>

				<!-- signature prism rim + glass edge -->
				<span class="prism-edge" />
				<span
					class="pointer-events-none absolute inset-0 rounded-[20px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
				/>

				<!-- hover scrim + caption -->
				<span
					class="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[rgba(30,20,45,0.62)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				/>
				<figcaption
					class="pointer-events-none absolute inset-x-3 bottom-3 z-10 truncate font-mono text-xs text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				>
					{{ photo.original_filename }}
				</figcaption>
			</figure>
		</div>
	</div>

	<!-- Real Filters sheet — binds to useLibrary filter state (real local data). -->
	<FiltersSheet v-model:open="filtersOpen" />

	<!-- Real detail panel — fully event-driven; mock handlers keep it inert. -->
	<PhotoViewer
		v-if="viewerOpen"
		:photos="mockPhotos"
		:index="viewerIndex"
		:all-tags="mockTags"
		@update:index="viewerIndex = $event"
		@close="viewerOpen = false"
		@favorite="(id) => {
			const p = mockPhotos.find((x) => x.id === id);
			if (p) p.is_favorite = p.is_favorite ? 0 : 1;
		}"
	/>
</template>
