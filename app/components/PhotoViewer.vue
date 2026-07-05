<script setup lang="ts">
import { ChevronLeft, ChevronRight, Download, Info, X } from "@lucide/vue";
import { Button } from "@/components/ui/button";

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
const showInfo = ref(true);

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
	else if (e.key === "i" || e.key === "I") showInfo.value = !showInfo.value;
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

function formatBytes(n: number | null): string | null {
	if (!n) return null;
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
}

// [label, value] rows for the info panel, skipping empty values.
const details = computed(() => {
	const p = photo.value;
	if (!p) return [];
	const camera = [p.camera_make, p.camera_model].filter(Boolean).join(" ");
	const rows: [string, string | null][] = [
		["Filename", p.original_filename],
		["Type", p.content_type],
		["Size", formatBytes(p.file_size)],
		["Uploaded", formatDate(p.uploaded_at)],
		["Taken", formatDate(p.taken_at)],
		["Camera", camera || null],
		["Lens", p.lens_info],
		["Exposure", p.exposure],
		["Aperture", p.aperture],
		["ISO", p.iso != null ? String(p.iso) : null],
		["Focal length", p.focal_length],
	];
	return rows.filter(([, v]) => v);
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
			class="fixed inset-0 z-50 flex bg-black/90"
			@click.self="emit('close')"
		>
			<!-- Image stage -->
			<div class="relative flex min-w-0 flex-1 items-center justify-center">
				<img
					:key="photo.id"
					:src="`/api/photos/${photo.id}/raw`"
					:alt="photo.original_filename"
					class="max-h-full max-w-full object-contain"
				/>

				<!-- Prev / next -->
				<Button
					v-if="index > 0"
					variant="secondary"
					size="icon"
					class="absolute left-3 top-1/2 -translate-y-1/2"
					@click="prev"
				>
					<ChevronLeft class="size-5" />
				</Button>
				<Button
					v-if="index < photos.length - 1"
					variant="secondary"
					size="icon"
					class="absolute right-3 top-1/2 -translate-y-1/2"
					@click="next"
				>
					<ChevronRight class="size-5" />
				</Button>

				<!-- Top-left counter -->
				<div class="absolute left-3 top-3 rounded bg-black/50 px-2 py-1 text-xs text-white">
					{{ index + 1 }} / {{ photos.length }}
				</div>

				<!-- Top-right controls -->
				<div class="absolute right-3 top-3 flex gap-2">
					<Button variant="secondary" size="icon" title="Info (i)" @click="showInfo = !showInfo">
						<Info class="size-4" />
					</Button>
					<Button variant="secondary" size="icon" title="Download" as-child>
						<a :href="`/api/photos/${photo.id}/raw`" :download="photo.original_filename">
							<Download class="size-4" />
						</a>
					</Button>
					<Button variant="secondary" size="icon" title="Close (Esc)" @click="emit('close')">
						<X class="size-4" />
					</Button>
				</div>
			</div>

			<!-- Info panel -->
			<aside
				v-if="showInfo"
				class="w-72 shrink-0 overflow-y-auto border-l border-white/10 bg-background p-4 text-sm"
			>
				<h2 class="mb-3 font-medium">Details</h2>
				<dl class="space-y-2">
					<div v-for="[label, value] in details" :key="label" class="flex flex-col">
						<dt class="text-xs text-muted-foreground">{{ label }}</dt>
						<dd class="break-words">{{ value }}</dd>
					</div>
				</dl>
				<a
					v-if="gpsUrl"
					:href="gpsUrl"
					target="_blank"
					rel="noopener"
					class="mt-3 inline-block text-xs underline"
				>
					View location on map
				</a>
			</aside>
		</div>
	</Teleport>
</template>
