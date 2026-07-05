import { toast } from "vue-sonner";
import type { FolderAction, FolderNode } from "@/components/FolderTree.vue";
import type { Photo, Tag } from "@/components/PhotoViewer.vue";

// A camera model or lens aggregated from EXIF, with its live-photo count.
export interface ExifFacet {
	name: string;
	photo_count: number;
}

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

	// ── Tag data ─────────────────────────────────────────────────────────────
	const { data: tagsData } = useFetch<{ tags: Tag[] }>("/api/tags", {
		key: "tags",
	});
	const tags = computed(() => tagsData.value?.tags ?? []);

	// ── Camera / lens data ─────────────────────────────────────────────────────
	// Aggregated from EXIF, live photos only. Each entry is { name, photo_count }.
	const { data: camerasData } = useFetch<{ cameras: ExifFacet[] }>(
		"/api/cameras",
		{ key: "cameras" },
	);
	const cameras = computed(() => camerasData.value?.cameras ?? []);
	const { data: lensesData } = useFetch<{ lenses: ExifFacet[] }>(
		"/api/lenses",
		{
			key: "lenses",
		},
	);
	const lenses = computed(() => lensesData.value?.lenses ?? []);

	// null = all photos · "none" = uncategorized · otherwise a folder id
	const selectedFolderId = useState<string | null>(
		"library:selected",
		() => null,
	);
	// Favorites is an orthogonal view: when on, the gallery filters to hearted
	// photos regardless of folder. Picking any folder view turns it back off.
	const favoritesOnly = useState("library:favorites", () => false);
	// Tag filter: when set, the gallery shows only photos carrying this tag id.
	// Exclusive with the folder / favorites views (picking one clears the others).
	const selectedTagId = useState<string | null>("library:tag", () => null);
	// Trash view: shows tombstoned (soft-deleted) photos. Another orthogonal,
	// exclusive view — picking any other filter turns it back off (and vice versa).
	const trashOnly = useState("library:trash", () => false);
	// Camera / lens filters: exact EXIF values. Orthogonal to folder/tag/favorites/
	// trash (picking either clears those) but NOT to each other — a camera and a
	// lens can be active at once and AND together server-side.
	const selectedCamera = useState<string | null>("library:camera", () => null);
	const selectedLens = useState<string | null>("library:lens", () => null);
	const expanded = useState<Set<string>>("library:expanded", () => new Set());
	const search = useState("library:search", () => "");

	// The sidebar filters drive the gallery, which only lives on "/". When a filter
	// is picked from another route (e.g. /map or /upload), route back to the gallery
	// so the selection is actually visible. No-op when already on "/".
	const route = useRoute();
	function goToGallery() {
		if (route.path !== "/") navigateTo("/");
	}

	// Pick a folder view (All / Uncategorized / a folder id) and leave the other
	// exclusive views (Favorites / Tag).
	// Clear the camera + lens EXIF filters. Called by every other view's select
	// (they're exclusive with camera/lens), but selectCamera/selectLens do NOT call
	// it — those two coexist and AND together.
	function clearExif() {
		selectedCamera.value = null;
		selectedLens.value = null;
	}

	function selectFolder(id: string | null) {
		favoritesOnly.value = false;
		selectedTagId.value = null;
		trashOnly.value = false;
		clearExif();
		selectedFolderId.value = id;
		goToGallery();
	}

	function selectFavorites() {
		selectedTagId.value = null;
		trashOnly.value = false;
		clearExif();
		favoritesOnly.value = true;
		goToGallery();
	}

	// Filter the gallery by a tag. Clears the folder / favorites / trash views.
	function selectTag(id: string) {
		favoritesOnly.value = false;
		trashOnly.value = false;
		selectedFolderId.value = null;
		clearExif();
		selectedTagId.value = id;
		goToGallery();
	}

	// Show the Trash (tombstoned photos). Exclusive with every other view.
	function selectTrash() {
		favoritesOnly.value = false;
		selectedTagId.value = null;
		selectedFolderId.value = null;
		clearExif();
		trashOnly.value = true;
		goToGallery();
	}

	// Filter by a camera model. Clears folder/tag/favorites/trash but KEEPS any
	// selected lens — so a camera + lens combination ANDs together in the gallery.
	function selectCamera(name: string) {
		favoritesOnly.value = false;
		trashOnly.value = false;
		selectedTagId.value = null;
		selectedFolderId.value = null;
		// Toggle off if re-picking the active camera.
		selectedCamera.value = selectedCamera.value === name ? null : name;
		goToGallery();
	}

	// Filter by a lens. Same rules as selectCamera — keeps any selected camera.
	function selectLens(name: string) {
		favoritesOnly.value = false;
		trashOnly.value = false;
		selectedTagId.value = null;
		selectedFolderId.value = null;
		selectedLens.value = selectedLens.value === name ? null : name;
		goToGallery();
	}

	const currentTitle = computed(() => {
		if (trashOnly.value) return "Trash";
		if (favoritesOnly.value) return "Favorites";
		if (selectedTagId.value)
			return `#${tags.value.find((t) => t.id === selectedTagId.value)?.name ?? "Tag"}`;
		// Camera + lens can be active together — join them for a combined title.
		if (selectedCamera.value || selectedLens.value)
			return [selectedCamera.value, selectedLens.value]
				.filter(Boolean)
				.join(" · ");
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
		await refreshNuxtData(["folders", "photos", "tags", "cameras", "lenses"]);
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

	// Bulk add: one request handles every id (the endpoint takes a photoIds array
	// and is idempotent). Returns true on success so callers can clear selection.
	async function addPhotosToFolder(
		photoIds: string[],
		folderId: string,
	): Promise<boolean> {
		if (photoIds.length === 0) return false;
		try {
			await $fetch(`/api/folders/${folderId}/photos`, {
				method: "POST",
				body: { photoIds },
			});
			await refreshAll();
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Update failed",
			);
			return false;
		}
	}

	// Bulk remove: ids ride the query string (the DELETE handler reads a
	// comma-joined photoIds param — DELETE bodies are dropped in the CF build).
	async function removePhotosFromFolder(
		photoIds: string[],
		folderId: string,
	): Promise<boolean> {
		if (photoIds.length === 0) return false;
		try {
			await $fetch(`/api/folders/${folderId}/photos`, {
				method: "DELETE",
				query: { photoIds: photoIds.join(",") },
			});
			await refreshAll();
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Update failed",
			);
			return false;
		}
	}

	async function toggleMembership(photo: Photo, folder: FolderNode) {
		const inFolder = foldersOf(photo).includes(folder.id);
		if (inFolder) await removePhotosFromFolder([photo.id], folder.id);
		else await addPhotosToFolder([photo.id], folder.id);
	}

	// ── Photo delete (soft) ──────────────────────────────────────────────────────
	// A plain DELETE now tombstones the photo (moves it to Trash) — its bytes + rows
	// survive until it's purged. Returns true on success so the caller (the viewer)
	// can advance nav / close after refreshing the list.
	async function deletePhoto(photo: Photo): Promise<boolean> {
		try {
			await $fetch(`/api/photos/${photo.id}`, { method: "DELETE" });
			await refreshNuxtData(["photos"]);
			toast.success("Moved to Trash");
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Delete failed",
			);
			return false;
		}
	}

	// Bulk (soft) delete: one batch request tombstones every id in a single D1
	// write (ids ride the query string — DELETE bodies are dropped in the CF build).
	// No partial-failure mixed state, then one list refresh and one toast.
	async function bulkDelete(photoIds: string[]): Promise<boolean> {
		if (photoIds.length === 0) return false;
		try {
			await $fetch("/api/photos", {
				method: "DELETE",
				query: { ids: photoIds.join(",") },
			});
			await refreshNuxtData(["photos"]);
			toast.success(
				`Moved ${photoIds.length} photo${photoIds.length === 1 ? "" : "s"} to Trash`,
			);
			return true;
		} catch (err) {
			await refreshNuxtData(["photos"]);
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Delete failed",
			);
			return false;
		}
	}

	// ── Trash: restore / permanent delete / empty ────────────────────────────────
	// Restore a tombstoned photo back to the live library (clears deleted_at).
	async function restorePhoto(photo: Photo): Promise<boolean> {
		try {
			await $fetch(`/api/photos/${photo.id}/restore`, { method: "POST" });
			await refreshNuxtData(["photos"]);
			toast.success("Photo restored");
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Restore failed",
			);
			return false;
		}
	}

	// Permanently delete one tombstoned photo (R2 object + all D1 rows). refreshAll
	// so folder/tag counts drop with the removed memberships.
	async function purgePhoto(photo: Photo): Promise<boolean> {
		try {
			await $fetch(`/api/photos/${photo.id}`, {
				method: "DELETE",
				query: { purge: "1" },
			});
			await refreshAll();
			toast.success("Photo permanently deleted");
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Delete failed",
			);
			return false;
		}
	}

	// Empty the whole Trash — permanently removes every tombstoned photo.
	async function emptyTrash(): Promise<boolean> {
		try {
			const res = await $fetch<{ purged: number }>("/api/photos/trash", {
				method: "DELETE",
			});
			await refreshAll();
			toast.success(
				`Emptied Trash — ${res.purged} photo${res.purged === 1 ? "" : "s"} removed`,
			);
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Empty failed",
			);
			return false;
		}
	}

	// ── Favorite toggle ─────────────────────────────────────────────────────────
	// Flip the heart on a photo. Optimistically mutate the row for instant UI, then
	// refresh the list (drops it from the Favorites view when un-hearted).
	async function toggleFavorite(photo: Photo): Promise<void> {
		try {
			const res = await $fetch<{ id: string; is_favorite: number }>(
				`/api/photos/${photo.id}/favorite`,
				{ method: "POST" },
			);
			photo.is_favorite = res.is_favorite;
			await refreshNuxtData(["photos"]);
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Update failed",
			);
		}
	}

	// ── Public sharing (publish / unpublish) ─────────────────────────────────────
	// Publish mints a FRESH token every call (rotation is the revocation primitive),
	// so re-publishing — including a show_location change — invalidates any prior URL.
	// Optimistically mirror the returned token onto the row (like toggleFavorite),
	// then refresh the list so the badge + server truth stay in sync.
	async function publishPhoto(
		photo: Photo,
		showLocation: boolean,
	): Promise<boolean> {
		try {
			const res = await $fetch<{ token: string }>(
				`/api/photos/${photo.id}/publish`,
				{ method: "POST", body: { showLocation } },
			);
			photo.visibility = "public";
			photo.public_token = res.token;
			photo.show_location = showLocation ? 1 : 0;
			await refreshNuxtData(["photos"]);
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Publish failed",
			);
			return false;
		}
	}

	// Revoke a photo's public share — drops the token so any shared URL 404s.
	async function unpublishPhoto(photo: Photo): Promise<boolean> {
		try {
			await $fetch(`/api/photos/${photo.id}/unpublish`, { method: "POST" });
			photo.visibility = "private";
			photo.public_token = null;
			await refreshNuxtData(["photos"]);
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ??
					"Unpublish failed",
			);
			return false;
		}
	}

	// ── Tags ─────────────────────────────────────────────────────────────────────
	// Resolve a photo's tag_ids into {id, name} pairs via the loaded tag list.
	function tagsOf(photo: Photo): { id: string; name: string }[] {
		if (!photo.tag_ids) return [];
		const byId = new Map(tags.value.map((t) => [t.id, t.name]));
		return photo.tag_ids
			.split(",")
			.map((id) => ({ id, name: byId.get(id) ?? id }));
	}

	// Attach a tag by name (reused if it exists, created otherwise). Refreshes the
	// photo list (so the row's tag_ids updates) and the tag list (counts / new tag).
	async function attachTag(photo: Photo, name: string): Promise<void> {
		try {
			await $fetch(`/api/photos/${photo.id}/tags`, {
				method: "POST",
				body: { names: [name] },
			});
			await refreshNuxtData(["photos", "tags"]);
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Update failed",
			);
		}
	}

	// Detach a tag by id. Ids ride the query string (DELETE bodies are dropped in
	// the CF build), mirroring folder photo removal.
	async function detachTag(photo: Photo, tagId: string): Promise<void> {
		try {
			await $fetch(`/api/photos/${photo.id}/tags`, {
				method: "DELETE",
				query: { tagIds: tagId },
			});
			await refreshNuxtData(["photos", "tags"]);
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Update failed",
			);
		}
	}

	// Delete a tag entirely (its junction rows cascade). If it was the active
	// filter, fall back to All photos.
	async function deleteTag(tag: Tag): Promise<void> {
		try {
			await $fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
			if (selectedTagId.value === tag.id) selectFolder(null);
			await refreshAll();
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Delete failed",
			);
		}
	}

	async function logout() {
		await $fetch("/api/auth/logout", { method: "POST" });
		await navigateTo("/login");
	}

	return {
		folders,
		tags,
		cameras,
		lenses,
		selectedFolderId,
		favoritesOnly,
		selectedTagId,
		trashOnly,
		selectedCamera,
		selectedLens,
		selectFolder,
		selectFavorites,
		selectTag,
		selectTrash,
		selectCamera,
		selectLens,
		expanded,
		search,
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
		addPhotosToFolder,
		removePhotosFromFolder,
		deletePhoto,
		bulkDelete,
		restorePhoto,
		purgePhoto,
		emptyTrash,
		toggleFavorite,
		// sharing
		publishPhoto,
		unpublishPhoto,
		// tags
		tagsOf,
		attachTag,
		detachTag,
		deleteTag,
		logout,
	};
}
