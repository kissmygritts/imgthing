<script setup lang="ts">
import { ChevronDown, ImageOff, MoreVertical } from "@lucide/vue";
import PhotoViewer, { type Photo } from "@/components/PhotoViewer.vue";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const {
	folders,
	selectedFolderId,
	search,
	currentTitle,
	foldersOf,
	toggleMembership,
} = useLibrary();

// Photos are the page's primary (SSR-critical) content, so fetch + await here.
// The keyed request lets mutations elsewhere refresh it via refreshNuxtData.
const photoQuery = computed(() =>
	selectedFolderId.value === null ? {} : { folderId: selectedFolderId.value },
);
const { data } = await useFetch<{ photos: Photo[] }>("/api/photos", {
	key: "photos",
	query: photoQuery,
});
const photos = computed(() => data.value?.photos ?? []);

// ── Search + sort (client-side over the fetched set) ──────────────────────
type SortMode = "newest" | "oldest" | "name";
const sortMode = ref<SortMode>("newest");
const sortLabels: Record<SortMode, string> = {
	newest: "Newest first",
	oldest: "Oldest first",
	name: "Filename A–Z",
};

const visiblePhotos = computed(() => {
	const q = search.value.trim().toLowerCase();
	const list = q
		? photos.value.filter((p) => p.original_filename.toLowerCase().includes(q))
		: photos.value.slice();
	list.sort((a, b) => {
		if (sortMode.value === "name")
			return a.original_filename.localeCompare(b.original_filename);
		const cmp = a.uploaded_at.localeCompare(b.uploaded_at);
		return sortMode.value === "oldest" ? cmp : -cmp;
	});
	return list;
});

const viewerIndex = ref<number | null>(null);
function openViewer(i: number) {
	viewerIndex.value = i;
}
</script>

<template>
	<div class="flex flex-1 flex-col gap-6">
		<header
			class="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5"
		>
			<div class="min-w-0">
				<h1 class="font-serif text-3xl font-normal tracking-tight text-foreground">
					{{ currentTitle }}
				</h1>
				<p class="mt-1 text-sm text-muted-foreground">
					{{ visiblePhotos.length }} photo{{ visiblePhotos.length === 1 ? "" : "s" }}
					<span v-if="search.trim()"> · filtered</span>
				</p>
			</div>

			<DropdownMenu>
				<DropdownMenuTrigger as-child>
					<button
						class="flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors hover:text-foreground"
					>
						{{ sortLabels[sortMode] }}
						<ChevronDown class="size-3 opacity-70" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" class="min-w-44">
					<DropdownMenuRadioGroup v-model="sortMode">
						<DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="name">Filename A–Z</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</header>

		<section
			v-if="visiblePhotos.length"
			class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
		>
			<figure
				v-for="(photo, i) in visiblePhotos"
				:key="photo.id"
				class="group relative aspect-square overflow-hidden rounded-[20px] shadow-[0_1px_2px_rgba(51,43,73,0.06),0_14px_30px_-16px_rgba(51,43,73,0.35)] transition-transform duration-300 hover:-translate-y-1"
			>
				<img
					:src="`/api/photos/${photo.id}/raw`"
					:alt="photo.original_filename"
					loading="lazy"
					class="absolute inset-0 size-full cursor-pointer object-cover"
					@click="openViewer(i)"
				/>

				<!-- signature prism rim (direct child of .group) -->
				<span class="prism-edge" />
				<span
					class="pointer-events-none absolute inset-0 rounded-[20px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
				/>

				<!-- hover scrim + caption -->
				<span
					class="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[rgba(30,20,45,0.62)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				/>
				<figcaption
					class="pointer-events-none absolute inset-x-3 bottom-2.5 translate-y-1.5 truncate text-xs font-semibold text-white opacity-0 transition duration-300 [text-shadow:0_1px_6px_rgba(0,0,0,0.35)] group-hover:translate-y-0 group-hover:opacity-100"
				>
					{{ photo.original_filename }}
				</figcaption>

				<!-- add-to-folder -->
				<DropdownMenu>
					<DropdownMenuTrigger as-child>
						<button
							class="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border border-white/70 bg-white/40 text-white opacity-0 backdrop-blur transition hover:bg-white/60 group-hover:opacity-100 data-[state=open]:opacity-100"
							title="Add to folder"
						>
							<MoreVertical class="size-4" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>Folders</DropdownMenuLabel>
						<template v-if="folders.length">
							<DropdownMenuSeparator />
							<DropdownMenuCheckboxItem
								v-for="folder in folders"
								:key="folder.id"
								:model-value="foldersOf(photo).includes(folder.id)"
								@select.prevent="toggleMembership(photo, folder)"
							>
								{{ folder.name }}
							</DropdownMenuCheckboxItem>
						</template>
						<p v-else class="px-2 py-1.5 text-xs text-muted-foreground">
							Create a folder first
						</p>
					</DropdownMenuContent>
				</DropdownMenu>
			</figure>
		</section>

		<section
			v-else
			class="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center"
		>
			<ImageOff class="size-8 text-muted-foreground" />
			<div class="space-y-1">
				<p class="font-medium">
					{{ search.trim() ? "No matches" : "No photos here" }}
				</p>
				<p class="text-sm text-muted-foreground">
					{{
						search.trim()
							? "Try a different search."
							: "Upload an image or add photos to this folder."
					}}
				</p>
			</div>
		</section>

		<!-- Photo viewer / lightbox -->
		<PhotoViewer
			v-if="viewerIndex !== null"
			:photos="visiblePhotos"
			:index="viewerIndex"
			@update:index="viewerIndex = $event"
			@close="viewerIndex = null"
		/>
	</div>
</template>
