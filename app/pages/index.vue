<script setup lang="ts">
import { ImageOff, MoreVertical } from "@lucide/vue";
import PhotoViewer, { type Photo } from "@/components/PhotoViewer.vue";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const { folders, selectedFolderId, currentTitle, foldersOf, toggleMembership } =
	useLibrary();

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

const viewerIndex = ref<number | null>(null);
function openViewer(i: number) {
	viewerIndex.value = i;
}
</script>

<template>
	<div class="flex flex-1 flex-col gap-4">
		<div class="flex items-baseline justify-between gap-4">
			<div>
				<h1 class="text-xl font-semibold tracking-tight">{{ currentTitle }}</h1>
				<p class="text-sm text-muted-foreground">
					{{ photos.length }} photo{{ photos.length === 1 ? "" : "s" }}
				</p>
			</div>
		</div>

		<section
			v-if="photos.length"
			class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
		>
			<figure
				v-for="(photo, i) in photos"
				:key="photo.id"
				class="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
			>
				<img
					:src="`/api/photos/${photo.id}/raw`"
					:alt="photo.original_filename"
					loading="lazy"
					class="size-full cursor-pointer object-cover transition-transform duration-200 group-hover:scale-105"
					@click="openViewer(i)"
				/>

				<DropdownMenu>
					<DropdownMenuTrigger as-child>
						<Button
							variant="secondary"
							size="icon"
							class="absolute right-1.5 top-1.5 size-7 opacity-0 shadow group-hover:opacity-100"
							title="Add to folder"
						>
							<MoreVertical class="size-4" />
						</Button>
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

				<figcaption
					class="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-xs text-white"
				>
					{{ photo.original_filename }}
				</figcaption>
			</figure>
		</section>

		<section
			v-else
			class="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center"
		>
			<ImageOff class="size-8 text-muted-foreground" />
			<div class="space-y-1">
				<p class="font-medium">No photos here</p>
				<p class="text-sm text-muted-foreground">
					Upload an image or add photos to this folder.
				</p>
			</div>
		</section>

		<!-- Photo viewer / lightbox -->
		<PhotoViewer
			v-if="viewerIndex !== null"
			:photos="photos"
			:index="viewerIndex"
			@update:index="viewerIndex = $event"
			@close="viewerIndex = null"
		/>
	</div>
</template>
