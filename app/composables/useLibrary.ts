import { toast } from "vue-sonner";
import type { FolderAction, FolderNode } from "@/components/FolderTree.vue";
import type { Photo } from "@/components/PhotoViewer.vue";

// Shared library state + actions, consumed by both the sidebar (chrome) and the
// gallery page. Folder data is fetched here; photo data is fetched in the page
// (it's the primary, SSR-critical content). Mutations refresh both via keys.
export function useLibrary() {
	// ── Folder data ──────────────────────────────────────────────────────────
	const { data: foldersData } = useFetch<{ folders: FolderNode[] }>(
		"/api/folders",
		{ key: "folders" },
	);
	const folders = computed(() => foldersData.value?.folders ?? []);

	// null = all photos · "none" = uncategorized · otherwise a folder id
	const selectedFolderId = useState<string | null>(
		"library:selected",
		() => null,
	);
	const expanded = useState<Set<string>>("library:expanded", () => new Set());

	const currentTitle = computed(() => {
		if (selectedFolderId.value === null) return "All photos";
		if (selectedFolderId.value === "none") return "Uncategorized";
		return (
			folders.value.find((f) => f.id === selectedFolderId.value)?.name ??
			"Folder"
		);
	});

	function toggleExpand(id: string) {
		const next = new Set(expanded.value);
		next.has(id) ? next.delete(id) : next.add(id);
		expanded.value = next;
	}

	async function refreshAll() {
		await refreshNuxtData(["folders", "photos"]);
	}

	// ── Upload ─────────────────────────────────────────────────────────────────
	const uploading = useState("library:uploading", () => false);

	async function upload(files: File[]) {
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
			await refreshAll();
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Upload failed",
			);
		} finally {
			uploading.value = false;
		}
	}

	// ── Folder create / rename dialog ──────────────────────────────────────────
	const dialogOpen = useState("library:dialogOpen", () => false);
	const dialogMode = useState<"create" | "rename">(
		"library:dialogMode",
		() => "create",
	);
	const dialogName = useState("library:dialogName", () => "");
	const dialogParentId = useState<string | null>(
		"library:dialogParent",
		() => null,
	);
	const dialogFolder = useState<FolderNode | null>(
		"library:dialogFolder",
		() => null,
	);
	const dialogBusy = useState("library:dialogBusy", () => false);

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
			await refreshNuxtData("folders");
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ??
					"Something failed",
			);
		} finally {
			dialogBusy.value = false;
		}
	}

	// ── Folder delete dialog ───────────────────────────────────────────────────
	const deleteTarget = useState<FolderNode | null>(
		"library:deleteTarget",
		() => null,
	);

	async function confirmDelete() {
		const folder = deleteTarget.value;
		if (!folder) return;
		try {
			await $fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
			if (selectedFolderId.value === folder.id) selectedFolderId.value = null;
			deleteTarget.value = null;
			await refreshAll();
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

	// ── Photo ↔ folder membership ──────────────────────────────────────────────
	function foldersOf(photo: Photo): string[] {
		return photo.folder_ids ? photo.folder_ids.split(",") : [];
	}

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
			await refreshAll();
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

	return {
		folders,
		selectedFolderId,
		expanded,
		currentTitle,
		toggleExpand,
		uploading,
		upload,
		// dialog
		dialogOpen,
		dialogMode,
		dialogName,
		dialogBusy,
		openCreate,
		submitDialog,
		deleteTarget,
		confirmDelete,
		onTreeAction,
		// membership
		foldersOf,
		toggleMembership,
		logout,
	};
}
