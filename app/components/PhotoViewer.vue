<script setup lang="ts">
import { ChevronLeft, ChevronRight, Download, X } from "@lucide/vue";

// Mirrors the row shape returned by GET /api/photos.
export interface Photo {
	id: string;
	original_filename: string;
	content_type: string | null;
	file_size: number | null;
	uploaded_at: string;
	camera_make: string | null;
	camera_model: string | null;
	lens_info: string | null;
	exposure: string | null;
	aperture: string | null;
	iso: number | null;
	focal_length: string | null;
	taken_at: string | null;
	gps_latitude: number | null;
	gps_longitude: number | null;
	folder_ids: string | null;
}

const props = defineProps<{
	photos: Photo[];
	index: number;
}>();

const emit = defineEmits<{
	close: [];
	"update:index": [value: number];
}>();

const photo = computed(() => props.photos[props.index] ?? null);

function prev() {
	if (props.index > 0) emit("update:index", props.index - 1);
}
function next() {
	if (props.index < props.photos.length - 1)
		emit("update:index", props.index + 1);
}

function onKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") emit("close");
	else if (e.key === "ArrowLeft") prev();
	else if (e.key === "ArrowRight") next();
}

onMounted(() => {
	window.addEventListener("keydown", onKeydown);
	document.body.style.overflow = "hidden";
});
onUnmounted(() => {
	window.removeEventListener("keydown", onKeydown);
	document.body.style.overflow = "";
});

function formatDate(iso: string | null): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? null
		: d.toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
}

const plate = computed(() => String(props.index + 1).padStart(3, "0"));

// [label, value] rows for the editorial fact list, in a fixed order. Missing
// values render as an em dash so the panel keeps its instrument-panel rhythm.
const facts = computed(() => {
	const p = photo.value;
	if (!p) return [];
	const camera = [p.camera_make, p.camera_model].filter(Boolean).join(" ");
	const rows: [string, string | null][] = [
		["Camera", camera || null],
		["Lens", p.lens_info],
		["Focal length", p.focal_length],
		["ISO", p.iso != null ? `ISO ${p.iso}` : null],
		["Shutter", p.exposure],
		["Aperture", p.aperture],
		["Date", formatDate(p.taken_at) ?? formatDate(p.uploaded_at)],
	];
	return rows;
});

const gpsUrl = computed(() =>
	photo.value?.gps_latitude != null && photo.value?.gps_longitude != null
		? `https://www.openstreetmap.org/?mlat=${photo.value.gps_latitude}&mlon=${photo.value.gps_longitude}#map=15/${photo.value.gps_latitude}/${photo.value.gps_longitude}`
		: null,
);
</script>

<template>
	<Teleport to="body">
		<div
			v-if="photo"
			class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
			role="dialog"
			aria-modal="true"
			aria-label="Photo viewer"
		>
			<!-- Blurred backdrop -->
			<button
				class="absolute inset-0 cursor-default bg-[rgba(60,45,80,0.28)] backdrop-blur-sm"
				aria-label="Close photo viewer"
				@click="emit('close')"
			/>

			<!-- Stage -->
			<div
				class="glass-panel relative z-[2] grid max-h-[88vh] w-[min(1120px,100%)] overflow-hidden rounded-[28px] md:grid-cols-[1fr_320px]"
			>
				<!-- Image -->
				<div class="relative flex min-h-[300px] items-center justify-center bg-black/5">
					<img
						:key="photo.id"
						:src="`/api/photos/${photo.id}/raw`"
						:alt="photo.original_filename"
						class="max-h-[88vh] w-full object-contain md:max-h-none"
					/>

					<button
						v-if="index > 0"
						class="absolute left-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/45 text-white backdrop-blur transition hover:bg-white/70"
						aria-label="Previous photo"
						@click="prev"
					>
						<ChevronLeft class="size-5" />
					</button>
					<button
						v-if="index < photos.length - 1"
						class="absolute right-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/45 text-white backdrop-blur transition hover:bg-white/70"
						aria-label="Next photo"
						@click="next"
					>
						<ChevronRight class="size-5" />
					</button>
				</div>

				<!-- Editorial metadata panel -->
				<aside
					class="relative flex flex-col overflow-y-auto bg-gradient-to-b from-white/80 to-white/55 p-7"
				>
					<button
						class="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full border border-white/85 bg-white/55 text-muted-foreground backdrop-blur transition hover:bg-white/85 hover:text-foreground"
						aria-label="Close photo viewer"
						@click="emit('close')"
					>
						<X class="size-4" />
					</button>

					<p
						class="mb-3 mr-9 font-mono text-[10.5px] font-semibold tracking-[0.14em] text-primary"
					>
						PLATE {{ plate }} / {{ photos.length }}
					</p>
					<h2
						class="mb-6 break-words font-serif text-[22px] italic leading-tight text-foreground"
					>
						{{ photo.original_filename }}
					</h2>

					<dl class="mb-auto grid gap-3">
						<div
							v-for="[label, value] in facts"
							:key="label"
							class="border-t border-border pt-2"
						>
							<dt
								class="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
							>
								{{ label }}
							</dt>
							<dd class="font-mono text-[13px] text-foreground">
								{{ value ?? "—" }}
							</dd>
						</div>
					</dl>

					<div class="mt-6 flex gap-2.5 border-t border-border pt-5">
						<a
							v-if="gpsUrl"
							:href="gpsUrl"
							target="_blank"
							rel="noopener"
							class="flex-1 rounded-xl border border-white/85 bg-white/50 px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground transition hover:bg-white/75 hover:text-foreground"
						>
							View location
						</a>
						<a
							:href="`/api/photos/${photo.id}/raw`"
							:download="photo.original_filename"
							class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-primary to-[#5a41b8] px-3 py-2.5 text-xs font-semibold text-white transition hover:brightness-105"
						>
							<Download class="size-3.5" />
							Download
						</a>
					</div>
				</aside>
			</div>
		</div>
	</Teleport>
</template>
