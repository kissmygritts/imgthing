<script setup lang="ts">
import {
	FolderPlus,
	ImageOff,
	Images,
	Layers,
	Loader2,
	MoreVertical,
	Upload,
} from "@lucide/vue";
import { toast } from "vue-sonner";
import type { FolderAction, FolderNode } from "@/components/FolderTree.vue";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface Photo {
	id: string;
	original_filename: string;
	uploaded_at: string;
	camera_model: string | null;
	taken_at: string | null;
	folder_ids: string | null;
}

// ── Folders ──────────────────────────────────────────────────────────────
const { data: foldersData, refresh: refreshFolders } = await useFetch<{
	folders: FolderNode[];
}>("/api/folders");
const folders = computed(() => foldersData.value?.folders ?? []);

// null = all photos · "none" = uncategorized · otherwise a folder id
const selectedFolderId = ref<string | null>(null);
const expanded = ref<Set<string>>(new Set());

const currentTitle = computed(() => {
	if (selectedFolderId.value === null) return "All photos";
	if (selectedFolderId.value === "none") return "Uncategorized";
	return (
		folders.value.find((f) => f.id === selectedFolderId.value)?.name ?? "Folder"
	);
});

function toggleExpand(id: string) {
	const next = new Set(expanded.value);
	next.has(id) ? next.delete(id) : next.add(id);
	expanded.value = next;
}

// ── Photos (reactively filtered by the selected folder) ──────────────────
const photoQuery = computed(() =>
	selectedFolderId.value === null ? {} : { folderId: selectedFolderId.value },
);
const { data, refresh } = await useFetch<{ photos: Photo[] }>("/api/photos", {
	query: photoQuery,
});
const photos = computed(() => data.value?.photos ?? []);

function foldersOf(photo: Photo): string[] {
	return photo.folder_ids ? photo.folder_ids.split(",") : [];
}

// ── Upload ───────────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

function pickFiles() {
	fileInput.value?.click();
}

async function onFilesSelected(event: Event) {
	const input = event.target as HTMLInputElement;
	const files = Array.from(input.files ?? []);
	input.value = "";
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
		await Promise.all([refresh(), refreshFolders()]);
	} catch (err) {
		toast.error(
			(err as { statusMessage?: string })?.statusMessage ?? "Upload failed",
		);
	} finally {
		uploading.value = false;
	}
}

// ── Folder create / rename dialog ────────────────────────────────────────
const dialogOpen = ref(false);
const dialogMode = ref<"create" | "rename">("create");
const dialogName = ref("");
const dialogParentId = ref<string | null>(null);
const dialogFolder = ref<FolderNode | null>(null);
const dialogBusy = ref(false);

function openCreate(parentId: string | null = null) {
	dialogMode.value = "create";
	dialogParentId.value = parentId;
	dialogFolder.value = null;
	dialogName.value = "";
	dialogOpen.value = true;
}

function openRename(folder: FolderNode) {
	dialogMode.value = "rename";
	dialogFolder.value = folder;
	dialogName.value = folder.name;
	dialogOpen.value = true;
}

async function submitDialog() {
	const name = dialogName.value.trim();
	if (!name) return;
	dialogBusy.value = true;
	try {
		if (dialogMode.value === "create") {
			await $fetch("/api/folders", {
				method: "POST",
				body: { name, parentFolderId: dialogParentId.value },
			});
			if (dialogParentId.value) {
				expanded.value = new Set(expanded.value).add(dialogParentId.value);
			}
		} else if (dialogFolder.value) {
			await $fetch(`/api/folders/${dialogFolder.value.id}`, {
				method: "PATCH",
				body: { name },
			});
		}
		dialogOpen.value = false;
		await refreshFolders();
	} catch (err) {
		toast.error(
			(err as { statusMessage?: string })?.statusMessage ?? "Something failed",
		);
	} finally {
		dialogBusy.value = false;
	}
}

// ── Folder delete dialog ─────────────────────────────────────────────────
const deleteTarget = ref<FolderNode | null>(null);

async function confirmDelete() {
	const folder = deleteTarget.value;
	if (!folder) return;
	try {
		await $fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
		if (selectedFolderId.value === folder.id) selectedFolderId.value = null;
		deleteTarget.value = null;
		await Promise.all([refreshFolders(), refresh()]);
	} catch (err) {
		toast.error(
			(err as { statusMessage?: string })?.statusMessage ?? "Delete failed",
		);
	}
}

function onTreeAction({
	type,
	folder,
}: {
	type: FolderAction;
	folder: FolderNode;
}) {
	if (type === "rename") openRename(folder);
	else if (type === "delete") deleteTarget.value = folder;
	else if (type === "new-sub") openCreate(folder.id);
}

// ── Photo membership ─────────────────────────────────────────────────────
async function toggleMembership(photo: Photo, folder: FolderNode) {
	const inFolder = foldersOf(photo).includes(folder.id);
	try {
		if (inFolder) {
			await $fetch(`/api/folders/${folder.id}/photos`, {
				method: "DELETE",
				query: { photoIds: photo.id },
			});
		} else {
			await $fetch(`/api/folders/${folder.id}/photos`, {
				method: "POST",
				body: { photoIds: [photo.id] },
			});
		}
		await Promise.all([refresh(), refreshFolders()]);
	} catch (err) {
		toast.error(
			(err as { statusMessage?: string })?.statusMessage ?? "Update failed",
		);
	}
}

async function logout() {
	await $fetch("/api/auth/logout", { method: "POST" });
	await navigateTo("/login");
}
</script>

<template>
	<div class="mx-auto flex min-h-svh w-full max-w-7xl gap-0">
		<!-- Sidebar -->
		<aside class="flex w-60 shrink-0 flex-col gap-2 border-r p-4">
			<div class="flex items-center justify-between">
				<h1 class="font-sans text-lg font-semibold tracking-tight">imgthing</h1>
				<Button
					variant="ghost"
					size="icon"
					class="size-7"
					title="New folder"
					@click="openCreate(null)"
				>
					<FolderPlus class="size-4" />
				</Button>
			</div>

			<nav class="flex flex-col gap-0.5">
				<button
					type="button"
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
					:class="selectedFolderId === null && 'bg-accent font-medium'"
					@click="selectedFolderId = null"
				>
					<Images class="size-4 text-muted-foreground" />
					All photos
				</button>
				<button
					type="button"
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
					:class="selectedFolderId === 'none' && 'bg-accent font-medium'"
					@click="selectedFolderId = 'none'"
				>
					<Layers class="size-4 text-muted-foreground" />
					Uncategorized
				</button>
			</nav>

			<div class="mt-1 border-t pt-2">
				<FolderTree
					v-if="folders.length"
					:folders="folders"
					:parent-id="null"
					:depth="0"
					:selected-id="selectedFolderId"
					:expanded="expanded"
					@select="selectedFolderId = $event"
					@action="onTreeAction"
					@toggle="toggleExpand"
				/>
				<p v-else class="px-2 py-1 text-xs text-muted-foreground">
					No folders yet
				</p>
			</div>
		</aside>

		<!-- Main -->
		<main class="flex min-w-0 flex-1 flex-col gap-6 p-6 sm:p-8">
			<header class="flex items-center justify-between gap-4">
				<div>
					<h2 class="text-2xl font-semibold tracking-tight">{{ currentTitle }}</h2>
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
		</main>

		<!-- Create / rename dialog -->
		<Dialog v-model:open="dialogOpen">
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{{ dialogMode === "create" ? "New folder" : "Rename folder" }}
					</DialogTitle>
					<DialogDescription>
						{{
							dialogMode === "create"
								? "Name your new folder."
								: "Give this folder a new name."
						}}
					</DialogDescription>
				</DialogHeader>
				<Input
					v-model="dialogName"
					placeholder="Folder name"
					autofocus
					@keydown.enter="submitDialog"
				/>
				<DialogFooter>
					<Button variant="outline" @click="dialogOpen = false">Cancel</Button>
					<Button :disabled="dialogBusy || !dialogName.trim()" @click="submitDialog">
						{{ dialogMode === "create" ? "Create" : "Save" }}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>

		<!-- Delete confirm dialog -->
		<Dialog :open="!!deleteTarget" @update:open="(v) => !v && (deleteTarget = null)">
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete “{{ deleteTarget?.name }}”?</DialogTitle>
					<DialogDescription>
						Subfolders are deleted too. Photos are not deleted — they only leave
						this folder.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" @click="deleteTarget = null">Cancel</Button>
					<Button variant="destructive" @click="confirmDelete">Delete</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	</div>
</template>
