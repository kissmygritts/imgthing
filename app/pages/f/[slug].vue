<script setup lang="ts">
import { ChevronLeft, ChevronRight, ImageOff, X } from "@lucide/vue";

// Public gallery page for a published folder. Unauthenticated — reached at
// /f/{slug}?token=. The {slug} is cosmetic; resolution is by token (see ADR
// 0008). Rendered WITHOUT the app layout (no sidebar/chrome) — it's a
// visitor-facing surface — on its own aurora, reusing Bright Studio Glass tokens.
//
// This is a Nuxt SSR *page* (not a Nitro route) on purpose: `createError(404)`
// on a page sets a real 404 status on the Cloudflare build (verified by test),
// unlike the /f/** Nitro serving routes where a thrown error would render the
// 200 app-shell. That lets the gallery reuse the glass components.
definePageMeta({ layout: false });

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const token = computed(() =>
	typeof route.query.token === "string" ? route.query.token : "",
);

interface GalleryPhoto {
	id: string;
	filename: string;
}

// SSR-fetch the whitelisted manifest. Any failure (bad/unpublished token) →
// a real 404 page. The list route itself returns a bare 404 on failure.
const { data, error } = await useFetch<{
	folderName: string;
	photos: GalleryPhoto[];
}>(() => `/f/${slug.value}/list`, {
	query: { token },
	key: () => `gallery:${slug.value}:${token.value}`,
});

if (error.value || !data.value) {
	throw createError({ statusCode: 404, statusMessage: "Not found" });
}

const folderName = computed(() => data.value?.folderName ?? "");
const photos = computed(() => data.value?.photos ?? []);
const count = computed(() => photos.value.length);

useHead({
	title: () => `${folderName.value} · imgthing`,
});

// Byte URLs for a member photo at a given size, token-scoped.
function photoUrl(id: string, size: "thumb" | "lg"): string {
	return `/f/${slug.value}/${id}/${size}?token=${token.value}`;
}

// ── Lightbox ────────────────────────────────────────────────────────────────
// Click a tile → full lg WebP over a glass scrim, with prev/next + close.
const lightboxIndex = ref<number | null>(null);
const activePhoto = computed(() =>
	lightboxIndex.value === null ? null : photos.value[lightboxIndex.value],
);

function openLightbox(i: number) {
	lightboxIndex.value = i;
}
function closeLightbox() {
	lightboxIndex.value = null;
}
function step(delta: number) {
	if (lightboxIndex.value === null) return;
	const n = photos.value.length;
	lightboxIndex.value = (lightboxIndex.value + delta + n) % n;
}

function onKeydown(e: KeyboardEvent) {
	if (lightboxIndex.value === null) return;
	if (e.key === "Escape") closeLightbox();
	else if (e.key === "ArrowLeft") step(-1);
	else if (e.key === "ArrowRight") step(1);
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
	<div class="relative min-h-screen">
		<!-- Aurora root plane -->
		<div class="aurora" aria-hidden="true">
			<span class="b1" />
			<span class="b2" />
			<span class="b3" />
			<span class="b4" />
		</div>

		<div class="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-7 sm:py-12">
			<!-- Header -->
			<header class="glass-panel relative overflow-hidden rounded-[26px] px-6 py-7 sm:px-8">
				<p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
					Public gallery
				</p>
				<h1 class="mt-1 font-serif text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
					{{ folderName }}
				</h1>
				<p class="mt-1 text-sm text-muted-foreground tabular-nums">
					{{ count }} photo{{ count === 1 ? "" : "s" }}
				</p>
			</header>

			<!-- Grid -->
			<div
				v-if="count"
				class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
			>
				<button
					v-for="(photo, i) in photos"
					:key="photo.id"
					type="button"
					class="group relative aspect-square overflow-hidden rounded-[20px] shadow-lg transition-transform duration-300 hover:-translate-y-1"
					@click="openLightbox(i)"
				>
					<img
						:src="photoUrl(photo.id, 'thumb')"
						:alt="photo.filename"
						loading="lazy"
						class="absolute inset-0 size-full object-cover"
					/>
					<span class="prism-edge" />
					<span
						class="pointer-events-none absolute inset-0 rounded-[20px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
					/>
				</button>
			</div>

			<!-- Empty published gallery -->
			<div
				v-else
				class="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center"
			>
				<ImageOff class="size-8 text-muted-foreground" />
				<p class="font-medium text-foreground">Nothing here yet</p>
				<p class="max-w-sm text-sm text-muted-foreground">
					This gallery has no photos.
				</p>
			</div>

			<!-- Wordplate footer -->
			<footer class="mt-auto flex items-center justify-center pt-4">
				<a
					href="/"
					class="opacity-60 transition-opacity hover:opacity-100"
					aria-label="imgthing"
				>
					<AppLogo :size="20" wordmark />
				</a>
			</footer>
		</div>

		<!-- Lightbox -->
		<Teleport to="body">
			<div
				v-if="activePhoto"
				class="glass-scrim fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
				@click.self="closeLightbox"
			>
				<img
					:src="photoUrl(activePhoto.id, 'lg')"
					:alt="activePhoto.filename"
					class="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
				/>

				<!-- Close -->
				<button
					type="button"
					aria-label="Close"
					class="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full border border-white/70 bg-white/40 text-white backdrop-blur transition hover:bg-white/60 dark:border-white/12 dark:bg-white/8 dark:hover:bg-white/15"
					@click="closeLightbox"
				>
					<X class="size-5" />
				</button>

				<!-- Prev / next -->
				<template v-if="count > 1">
					<button
						type="button"
						aria-label="Previous"
						class="absolute left-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/40 text-white backdrop-blur transition hover:bg-white/60 dark:border-white/12 dark:bg-white/8 dark:hover:bg-white/15"
						@click.stop="step(-1)"
					>
						<ChevronLeft class="size-5" />
					</button>
					<button
						type="button"
						aria-label="Next"
						class="absolute right-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/40 text-white backdrop-blur transition hover:bg-white/60 dark:border-white/12 dark:bg-white/8 dark:hover:bg-white/15"
						@click.stop="step(1)"
					>
						<ChevronRight class="size-5" />
					</button>
				</template>

				<!-- Filename plate -->
				<div
					class="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-white/70 bg-white/40 px-4 py-1.5 text-white backdrop-blur dark:border-white/12 dark:bg-white/8"
				>
					<span class="font-serif italic">{{ activePhoto.filename }}</span>
				</div>
			</div>
		</Teleport>
	</div>
</template>
