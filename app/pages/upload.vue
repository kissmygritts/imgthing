<script setup lang="ts">
import {
	CircleAlert,
	CircleCheck,
	CircleX,
	CloudUpload,
	Folder,
	ImagePlus,
	Loader2,
	Trash2,
	Upload,
} from "@lucide/vue";
import { toast } from "vue-sonner";
import type { FolderNode } from "@/components/FolderTree.vue";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const { folders } = useLibrary();

// ── Target folder selector ───────────────────────────────────────────────────
// "" = no folder (lands in the library uncategorized). Otherwise a folder id.
const targetFolderId = ref<string>("");

// Flatten the folder tree into indented options so nesting reads clearly in the
// picker. Depth-first from the roots, mirroring the sidebar's ordering.
interface FolderOption {
	id: string;
	name: string;
	depth: number;
}
const folderOptions = computed<FolderOption[]>(() => {
	const all = folders.value;
	const out: FolderOption[] = [];
	const walk = (parentId: string | null, depth: number) => {
		for (const f of all.filter((x) => x.parent_folder_id === parentId)) {
			out.push({ id: f.id, name: f.name, depth });
			walk(f.id, depth + 1);
		}
	};
	walk(null, 0);
	return out;
});
const targetFolderName = computed(
	() =>
		folders.value.find((f: FolderNode) => f.id === targetFolderId.value)?.name,
);

// ── Upload queue ─────────────────────────────────────────────────────────────
type QueueStatus = "pending" | "uploading" | "done" | "error" | "rejected";
interface QueueItem {
	id: string;
	file: File;
	name: string;
	size: number;
	status: QueueStatus;
	progress: number; // 0–100
	error?: string;
}

const queue = ref<QueueItem[]>([]);
const isUploading = ref(false);
const dragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const pending = computed(() =>
	queue.value.filter((q) => q.status === "pending"),
);
const doneCount = computed(
	() => queue.value.filter((q) => q.status === "done").length,
);
const failedCount = computed(
	() => queue.value.filter((q) => q.status === "error").length,
);

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Add files to the queue: non-images are kept but flagged as rejected so the user
// sees why they won't upload, rather than silently vanishing.
function enqueue(files: File[]) {
	for (const file of files) {
		const isImage = file.type.startsWith("image/");
		queue.value.push({
			id: crypto.randomUUID(),
			file,
			name: file.name,
			size: file.size,
			status: isImage ? "pending" : "rejected",
			progress: 0,
			error: isImage ? undefined : "Not an image",
		});
	}
}

function onDrop(ev: DragEvent) {
	dragging.value = false;
	const files = Array.from(ev.dataTransfer?.files ?? []);
	if (files.length) enqueue(files);
}

function onPick(ev: Event) {
	const input = ev.target as HTMLInputElement;
	enqueue(Array.from(input.files ?? []));
	input.value = "";
}

function removeItem(id: string) {
	queue.value = queue.value.filter((q) => q.id !== id);
}

function clearFinished() {
	queue.value = queue.value.filter(
		(q) => q.status === "pending" || q.status === "uploading",
	);
}

// Upload a single file via XHR so we can surface real per-file progress. Resolves
// to true on success; on failure it flips the item to `error` and resolves false.
function uploadOne(item: QueueItem): Promise<boolean> {
	return new Promise((resolve) => {
		const form = new FormData();
		form.append("files", item.file);
		if (targetFolderId.value) form.append("folderId", targetFolderId.value);

		const xhr = new XMLHttpRequest();
		xhr.open("POST", "/api/photos");
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) {
				item.progress = Math.round((e.loaded / e.total) * 100);
			}
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				item.status = "done";
				item.progress = 100;
				resolve(true);
			} else {
				let message = `Upload failed (${xhr.status})`;
				try {
					const body = JSON.parse(xhr.responseText);
					if (body?.statusMessage) message = body.statusMessage;
				} catch {
					// non-JSON response — keep the status-based message
				}
				item.status = "error";
				item.error = message;
				resolve(false);
			}
		};
		xhr.onerror = () => {
			item.status = "error";
			item.error = "Network error";
			resolve(false);
		};
		item.status = "uploading";
		item.progress = 0;
		xhr.send(form);
	});
}

// Upload pending items sequentially so progress bars stay legible and we don't
// swamp the worker. Refreshes the library afterwards so the new photos appear.
async function startUpload() {
	if (isUploading.value) return;
	const items = pending.value;
	if (items.length === 0) return;
	isUploading.value = true;
	let ok = 0;
	let failed = 0;
	try {
		for (const item of items) {
			if (await uploadOne(item)) ok++;
			else failed++;
		}
		await refreshNuxtData(["folders", "photos", "tags"]);
		if (ok > 0) {
			const where = targetFolderName.value
				? ` to ${targetFolderName.value}`
				: "";
			toast.success(`Uploaded ${ok} photo${ok === 1 ? "" : "s"}${where}`);
		}
		if (failed > 0) {
			toast.error(`${failed} upload${failed === 1 ? "" : "s"} failed`);
		}
	} finally {
		isUploading.value = false;
	}
}
</script>

<template>
	<div class="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
		<header class="border-b border-border pb-5">
			<h1 class="font-serif text-3xl font-normal tracking-tight text-foreground">
				Upload photos
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Drag images in or browse, pick a destination, and send them to your
				library.
			</p>
		</header>

		<!-- Target folder selector -->
		<div class="flex flex-wrap items-center gap-3">
			<span class="text-sm font-medium text-foreground">Destination</span>
			<DropdownMenu>
				<DropdownMenuTrigger as-child>
					<button
						class="flex items-center gap-2 rounded-full border border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 px-4 py-2 text-sm font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors hover:bg-white/70 dark:hover:bg-white/18"
					>
						<Folder class="size-4 text-primary" />
						{{ targetFolderName ?? "No folder" }}
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" class="max-h-72 min-w-56 overflow-y-auto">
					<DropdownMenuLabel>Upload into</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuRadioGroup v-model="targetFolderId">
						<DropdownMenuRadioItem value="">No folder</DropdownMenuRadioItem>
						<DropdownMenuRadioItem
							v-for="opt in folderOptions"
							:key="opt.id"
							:value="opt.id"
						>
							<span :style="{ paddingLeft: `${opt.depth * 12}px` }">
								{{ opt.name }}
							</span>
						</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>

		<!-- Drop zone -->
		<button
			type="button"
			class="flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors"
			:class="
				dragging
					? 'border-primary bg-primary/10'
					: 'border-border bg-white/30 dark:bg-white/10 hover:border-primary/50 hover:bg-white/40 dark:hover:bg-white/8'
			"
			@click="fileInput?.click()"
			@dragover.prevent="dragging = true"
			@dragenter.prevent="dragging = true"
			@dragleave.prevent="dragging = false"
			@drop.prevent="onDrop"
		>
			<span
				class="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"
			>
				<CloudUpload class="size-7" />
			</span>
			<span class="space-y-1">
				<span class="block text-base font-semibold text-foreground">
					Drop images here
				</span>
				<span class="block text-sm text-muted-foreground">
					or click to browse — PNG, JPG, WebP, and more
				</span>
			</span>
			<input
				ref="fileInput"
				type="file"
				accept="image/*"
				multiple
				class="hidden"
				@change="onPick"
			/>
		</button>

		<!-- Queue -->
		<section v-if="queue.length" class="flex flex-col gap-3">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-semibold text-foreground">
					Queue
					<span class="font-normal text-muted-foreground">
						· {{ queue.length }} file{{ queue.length === 1 ? "" : "s" }}
						<template v-if="doneCount"> · {{ doneCount }} done</template>
						<template v-if="failedCount"> · {{ failedCount }} failed</template>
					</span>
				</h2>
				<button
					v-if="doneCount || failedCount"
					class="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
					@click="clearFinished"
				>
					Clear finished
				</button>
			</div>

			<ul class="flex flex-col gap-2">
				<li
					v-for="item in queue"
					:key="item.id"
					class="flex items-center gap-3 rounded-2xl border border-white/60 dark:border-white/12 bg-white/45 dark:bg-white/10 px-3 py-2.5"
				>
					<span
						class="flex size-9 shrink-0 items-center justify-center rounded-xl"
						:class="{
							'bg-primary/15 text-primary': item.status === 'pending' || item.status === 'uploading',
							'bg-emerald-500/15 text-emerald-600': item.status === 'done',
							'bg-destructive/15 text-destructive': item.status === 'error',
							'bg-amber-500/15 text-amber-600': item.status === 'rejected',
						}"
					>
						<Loader2 v-if="item.status === 'uploading'" class="size-4 animate-spin" />
						<CircleCheck v-else-if="item.status === 'done'" class="size-4" />
						<CircleX v-else-if="item.status === 'error'" class="size-4" />
						<CircleAlert v-else-if="item.status === 'rejected'" class="size-4" />
						<ImagePlus v-else class="size-4" />
					</span>

					<div class="min-w-0 flex-1">
						<div class="flex items-center justify-between gap-2">
							<p class="truncate text-sm font-medium text-foreground">
								{{ item.name }}
							</p>
							<span class="shrink-0 text-xs text-muted-foreground">
								{{ formatSize(item.size) }}
							</span>
						</div>

						<!-- progress / status line -->
						<div
							v-if="item.status === 'uploading'"
							class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary/15"
						>
							<div
								class="h-full rounded-full bg-primary transition-[width] duration-150"
								:style="{ width: `${item.progress}%` }"
							/>
						</div>
						<p
							v-else-if="item.status === 'error'"
							class="mt-0.5 truncate text-xs text-destructive"
						>
							{{ item.error }}
						</p>
						<p
							v-else-if="item.status === 'rejected'"
							class="mt-0.5 text-xs text-amber-600"
						>
							Not an image — won't be uploaded
						</p>
						<p
							v-else-if="item.status === 'done'"
							class="mt-0.5 text-xs text-emerald-600"
						>
							Uploaded
						</p>
						<p v-else class="mt-0.5 text-xs text-muted-foreground">Ready</p>
					</div>

					<button
						v-if="item.status !== 'uploading'"
						class="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
						title="Remove"
						@click="removeItem(item.id)"
					>
						<Trash2 class="size-4" />
					</button>
				</li>
			</ul>
		</section>

		<!-- Actions -->
		<div class="flex items-center justify-end gap-3 pb-2">
			<button
				type="button"
				:disabled="isUploading || pending.length === 0"
				class="flex items-center gap-2 rounded-2xl bg-gradient-to-b from-primary to-[#5a41b8] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/40 transition-transform hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
				@click="startUpload"
			>
				<Loader2 v-if="isUploading" class="size-4 animate-spin" />
				<Upload v-else class="size-4" />
				{{
					isUploading
						? "Uploading…"
						: pending.length
							? `Upload ${pending.length} photo${pending.length === 1 ? "" : "s"}`
							: "Upload"
				}}
			</button>
		</div>
	</div>
</template>
