<script setup lang="ts">
import { ImageOff, Loader2 } from "@lucide/vue";
import PhotoViewer, { type Photo } from "@/components/PhotoViewer.vue";
import { SidebarTrigger } from "@/components/ui/sidebar";

// Plot every geotagged photo on a full-bleed MapLibre map (OpenFreeMap tiles,
// no API key). Clicking a marker opens the shared PhotoViewer. Data is fetched
// client-side: maplibre-gl is browser-only, and this dodges the known SSR
// hydration quirk where server-rendered lists come back empty.

const { tags, toggleFavorite, deletePhoto, attachTag, detachTag } =
	useLibrary();

const photos = ref<Photo[]>([]);
const loading = ref(true);
const viewerIndex = ref<number | null>(null);

const mapEl = ref<HTMLElement | null>(null);
// Kept outside reactive state — MapLibre instances shouldn't be proxied.
let map: import("maplibre-gl").Map | null = null;
let markers: import("maplibre-gl").Marker[] = [];

function openViewer(i: number) {
	viewerIndex.value = i;
}

async function loadGeo(): Promise<void> {
	const res = await $fetch<{ photos: Photo[] }>("/api/photos/geo");
	photos.value = res.photos;
}

async function renderMarkers(): Promise<void> {
	if (!map) return;
	const maplibregl = await import("maplibre-gl");
	for (const m of markers) m.remove();
	markers = [];
	if (photos.value.length === 0) return;

	const bounds = new maplibregl.LngLatBounds();
	photos.value.forEach((photo, i) => {
		const lat = photo.gps_latitude;
		const lng = photo.gps_longitude;
		if (lat == null || lng == null) return;

		// Custom marker: a circular thumbnail pin. Inline styles so it survives
		// outside Vue's scoped-CSS boundary (MapLibre appends it to the map root).
		const el = document.createElement("button");
		el.type = "button";
		el.setAttribute("aria-label", photo.original_filename);
		el.style.cssText =
			"width:46px;height:46px;border-radius:50%;border:2.5px solid #fff;" +
			"background-size:cover;background-position:center;cursor:pointer;" +
			"box-shadow:0 4px 14px -3px rgba(60,45,90,0.55);" +
			`background-image:url(/api/photos/${photo.id}/variant?size=thumb)`;
		el.addEventListener("click", (e) => {
			e.stopPropagation();
			openViewer(i);
		});

		// Popup shows the filename on hover — a light touch over the thumb pin.
		const popup = new maplibregl.Popup({
			offset: 28,
			closeButton: false,
			closeOnClick: false,
		}).setText(photo.original_filename);

		const marker = new maplibregl.Marker({ element: el })
			.setLngLat([lng, lat])
			.setPopup(popup)
			.addTo(map as import("maplibre-gl").Map);
		el.addEventListener("mouseenter", () => marker.togglePopup());
		el.addEventListener("mouseleave", () => popup.remove());

		markers.push(marker);
		bounds.extend([lng, lat]);
	});

	if (markers.length === 1) {
		map.setCenter(bounds.getCenter());
		map.setZoom(9);
	} else if (markers.length > 1) {
		map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 0 });
	}
}

onMounted(async () => {
	const maplibregl = await import("maplibre-gl");
	try {
		await loadGeo();
	} finally {
		loading.value = false;
	}
	if (!mapEl.value) return;
	map = new maplibregl.Map({
		container: mapEl.value,
		style: "https://tiles.openfreemap.org/styles/liberty",
		center: [0, 20],
		zoom: 1.5,
		attributionControl: { compact: true },
	});
	map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
	map.on("load", () => {
		renderMarkers();
	});
});

onUnmounted(() => {
	for (const m of markers) m.remove();
	map?.remove();
	map = null;
});

// Re-plot when a viewer mutation changes the geotagged set (e.g. a delete).
async function refetch(): Promise<void> {
	await loadGeo();
	await renderMarkers();
}

function onViewerFavorite(id: string) {
	const photo = photos.value.find((p) => p.id === id);
	if (photo) toggleFavorite(photo);
}
async function onViewerAttachTag(id: string, name: string) {
	const photo = photos.value.find((p) => p.id === id);
	if (photo) {
		await attachTag(photo, name);
		await refetch();
	}
}
async function onViewerDetachTag(id: string, tagId: string) {
	const photo = photos.value.find((p) => p.id === id);
	if (photo) {
		await detachTag(photo, tagId);
		await refetch();
	}
}
async function onViewerDelete(id: string) {
	const photo = photos.value.find((p) => p.id === id);
	if (!photo) return;
	if (!(await deletePhoto(photo))) return;
	await refetch();
	await nextTick();
	const count = photos.value.length;
	if (count === 0 || viewerIndex.value === null) viewerIndex.value = null;
	else if (viewerIndex.value > count - 1) viewerIndex.value = count - 1;
}
</script>

<template>
	<!-- Full-bleed: break out of the layout's padded panel to fill the glass. -->
	<div class="absolute inset-0">
		<SidebarTrigger
			class="absolute left-3 top-3 z-20 border border-white/70 bg-white/60 backdrop-blur md:hidden"
		/>

		<div ref="mapEl" class="size-full" />

		<!-- Loading + empty states float over the (still-mounting) map. -->
		<div
			v-if="loading"
			class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
		>
			<Loader2 class="size-6 animate-spin text-primary" />
		</div>
		<div
			v-else-if="!photos.length"
			class="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center"
		>
			<div
				class="glass-panel flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground"
			>
				<ImageOff class="size-4" />
				No geotagged photos yet
			</div>
		</div>

		<PhotoViewer
			v-if="viewerIndex !== null"
			:photos="photos"
			:index="viewerIndex"
			:all-tags="tags"
			@update:index="viewerIndex = $event"
			@close="viewerIndex = null"
			@delete="onViewerDelete"
			@favorite="onViewerFavorite"
			@attach-tag="onViewerAttachTag"
			@detach-tag="onViewerDetachTag"
		/>
	</div>
</template>
