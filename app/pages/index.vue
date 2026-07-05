<script setup lang="ts">
import { ImageOff, Loader2, Upload } from "@lucide/vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";

interface Photo {
	id: string;
	original_filename: string;
	uploaded_at: string;
	camera_model: string | null;
	taken_at: string | null;
}

const { data, refresh } = await useFetch<{ photos: Photo[] }>("/api/photos");
const photos = computed(() => data.value?.photos ?? []);

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

function pickFiles() {
	fileInput.value?.click();
}

async function onFilesSelected(event: Event) {
	const input = event.target as HTMLInputElement;
	const files = Array.from(input.files ?? []);
	input.value = ""; // allow re-selecting the same file
	if (files.length === 0) return;

	uploading.value = true;
	const form = new FormData();
	for (const file of files) form.append("files", file);

	try {
		const res = await $fetch<{ uploaded: { id: string }[] }>("/api/photos", {
			method: "POST",
			body: form,
		});
		toast.success(
			`Uploaded ${res.uploaded.length} photo${res.uploaded.length === 1 ? "" : "s"}`,
		);
		await refresh();
	} catch (err) {
		toast.error(
			(err as { statusMessage?: string })?.statusMessage ?? "Upload failed",
		);
	} finally {
		uploading.value = false;
	}
}

async function logout() {
	await $fetch("/api/auth/logout", { method: "POST" });
	await navigateTo("/login");
}
</script>

<template>
	<main class="mx-auto flex min-h-svh max-w-6xl flex-col gap-8 p-6 sm:p-8">
		<header class="flex items-center justify-between gap-4">
			<div>
				<h1 class="font-sans text-2xl font-semibold tracking-tight">imgthing</h1>
				<p class="text-sm text-muted-foreground">
					{{ photos.length }} photo{{ photos.length === 1 ? "" : "s" }}
				</p>
			</div>
			<div class="flex items-center gap-2">
				<input
					ref="fileInput"
					type="file"
					accept="image/*"
					multiple
					class="hidden"
					@change="onFilesSelected"
				/>
				<Button :disabled="uploading" @click="pickFiles">
					<Loader2 v-if="uploading" class="size-4 animate-spin" />
					<Upload v-else class="size-4" />
					{{ uploading ? "Uploading…" : "Upload photos" }}
				</Button>
				<Button variant="outline" @click="logout">Sign out</Button>
			</div>
		</header>

		<section v-if="photos.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
			<figure
				v-for="photo in photos"
				:key="photo.id"
				class="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
			>
				<img
					:src="`/api/photos/${photo.id}/raw`"
					:alt="photo.original_filename"
					loading="lazy"
					class="size-full object-cover transition-transform duration-200 group-hover:scale-105"
				/>
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
				<p class="font-medium">No photos yet</p>
				<p class="text-sm text-muted-foreground">
					Upload an image to get started.
				</p>
			</div>
		</section>
	</main>
</template>
