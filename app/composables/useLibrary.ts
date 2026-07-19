import { toast } from "vue-sonner";
import type { FolderAction, FolderNode } from "@/components/FolderTree.vue";
import type { Photo, Tag } from "@/components/PhotoViewer.vue";
import { monthLabel } from "@/lib/date";

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

	// ── Storage-usage stats ────────────────────────────────────────────────────
	// Live count + summed bytes (trash excluded), plus the tombstoned figures.
	// Refreshed via the "stats" key in refreshAll after uploads/deletes.
	const { data: statsData } = useFetch<{
		count: number;
		totalBytes: number;
		trashedCount: number;
		trashedBytes: number;
	}>("/api/photos/stats", { key: "stats" });
	const stats = computed(
		() =>
			statsData.value ?? {
				count: 0,
				totalBytes: 0,
				trashedCount: 0,
				trashedBytes: 0,
			},
	);

	// ── Scope ────────────────────────────────────────────────────────────────
	// Which slice of the library the gallery is anchored to: current folder,
	// Trash, or a calendar month. Navigational and exclusive — picking one
	// clears the others. See CONTEXT.md "Filtering & scope".
	//
	// null = all photos · "none" = uncategorized · otherwise a folder id
	const selectedFolderId = useState<string | null>(
		"library:selected",
		() => null,
	);
	// Trash view: shows tombstoned (soft-deleted) photos.
	const trashOnly = useState("library:trash", () => false);
	// Month scope: the calendar view enters the gallery constrained to one capture
	// month ("YYYY-MM"). In-memory only (not the URL), so a hard reload of "/"
	// falls back to All photos.
	const monthScope = useState<string | null>("library:month", () => null);

	// ── Filters ──────────────────────────────────────────────────────────────
	// Facets that narrow what's shown *within* the current scope. Composable —
	// every filter ANDs together (tags OR within themselves) and live-updates
	// the grid. Surfaced together in the Filters sheet. See CONTEXT.md
	// "Filtering & scope".
	const favoritesOnly = useState("library:favorites", () => false);
	// Multi-select: photos carrying ANY of these tag ids match (OR'd), then AND
	// against every other active filter.
	const selectedTagIds = useState<string[]>("library:tags", () => []);
	// Exact EXIF values. AND with each other and with every other filter.
	const selectedCamera = useState<string | null>("library:camera", () => null);
	const selectedLens = useState<string | null>("library:lens", () => null);
	const visibilityFilter = useState<"any" | "public" | "private">(
		"library:visibility",
		() => "any",
	);
	const filterDateFrom = useState<string | null>(
		"library:filterDateFrom",
		() => null,
	);
	const filterDateTo = useState<string | null>(
		"library:filterDateTo",
		() => null,
	);

	const activeFilterCount = computed(() => {
		let n = 0;
		if (favoritesOnly.value) n++;
		if (selectedTagIds.value.length) n++;
		if (selectedCamera.value) n++;
		if (selectedLens.value) n++;
		if (visibilityFilter.value !== "any") n++;
		if (filterDateFrom.value || filterDateTo.value) n++;
		return n;
	});

	function clearFilters() {
		favoritesOnly.value = false;
		selectedTagIds.value = [];
		selectedCamera.value = null;
		selectedLens.value = null;
		visibilityFilter.value = "any";
		filterDateFrom.value = null;
		filterDateTo.value = null;
	}

	const expanded = useState<Set<string>>("library:expanded", () => new Set());
	const search = useState("library:search", () => "");

	// The sidebar filters drive the gallery, which only lives on "/". When a filter
	// is picked from another route (e.g. /map or /upload), route back to the gallery
	// so the selection is actually visible. No-op when already on "/".
	const route = useRoute();
	function goToGallery() {
		if (route.path !== "/") navigateTo("/");
	}

	// Pick a scope (All / Uncategorized / a folder id). Scope is exclusive with
	// Trash and month — picking one clears the others — but leaves every filter
	// (favorites/tag/camera/lens/visibility/date) untouched: filters compose
	// within whichever scope is active.
	function selectFolder(id: string | null) {
		trashOnly.value = false;
		monthScope.value = null;
		selectedFolderId.value = id;
		goToGallery();
	}

	// Show the Trash (tombstoned photos). Exclusive with folder/month scope.
	function selectTrash() {
		selectedFolderId.value = null;
		monthScope.value = null;
		trashOnly.value = true;
		goToGallery();
	}

	// Enter a month scope from the calendar. Exclusive with folder/Trash scope.
	function selectMonth(monthKey: string) {
		trashOnly.value = false;
		selectedFolderId.value = null;
		monthScope.value = monthKey;
		goToGallery();
	}

	// Toggle the favorites filter on/off. Composes with every other filter and
	// with whichever scope is active.
	function toggleFavorites() {
		favoritesOnly.value = !favoritesOnly.value;
		goToGallery();
	}

	// Toggle a tag in the multi-select filter (OR'd within the tag facet).
	function toggleTag(id: string) {
		selectedTagIds.value = selectedTagIds.value.includes(id)
			? selectedTagIds.value.filter((t) => t !== id)
			: [...selectedTagIds.value, id];
		goToGallery();
	}

	// Toggle a camera filter (re-picking the active one clears it). ANDs with
	// any selected lens and every other filter.
	function toggleCamera(name: string) {
		selectedCamera.value = selectedCamera.value === name ? null : name;
		goToGallery();
	}

	// Toggle a lens filter. Same rules as toggleCamera — ANDs with camera.
	function toggleLens(name: string) {
		selectedLens.value = selectedLens.value === name ? null : name;
		goToGallery();
	}

	// Scope-only title: reflects where you're browsing (folder / Trash / month),
	// not which filters are active. Active filters surface via activeFilterCount
	// and the "· filtered" grid annotation instead — with composable filters,
	// no single label could summarize an arbitrary combination.
	const currentTitle = computed(() => {
		if (monthScope.value) return monthLabel(monthScope.value);
		if (trashOnly.value) return "Trash";
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
		await refreshNuxtData([
			"folders",
			"photos",
			"tags",
			"cameras",
			"lenses",
			"stats",
			"months",
		]);
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

	// ── Folder publishing (public galleries) ───────────────────────────────────
	// The share dialog target (a folder to publish/unpublish). Mirrors the
	// create/rename/delete dialog states.
	const shareTarget = useState<FolderNode | null>(
		"library:shareTarget",
		() => null,
	);
	const shareBusy = useState("library:shareBusy", () => false);

	function openShare(folder: FolderNode) {
		shareTarget.value = folder;
	}

	// Build the /f/{slug}?token= public link for a published folder (origin from
	// the browser; "" during SSR). The slug is cosmetic — resolution is by token
	// (ADR 0008) — so a stale slug after a rename still resolves.
	function folderShareUrl(folder: FolderNode | null): string {
		if (!folder?.public_token) return "";
		const origin = import.meta.client ? window.location.origin : "";
		const slug =
			folder.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "") || "gallery";
		return `${origin}/f/${slug}?token=${folder.public_token}`;
	}

	// Publish a folder as a public gallery. IDEMPOTENT server-side (no token
	// rotation), so a stable link survives re-publish. Optimistically mirror the
	// public state onto the row (like publishPhoto), then refresh so the tree glyph
	// + server truth stay in sync.
	async function publishFolder(folder: FolderNode): Promise<boolean> {
		shareBusy.value = true;
		try {
			const res = await $fetch<{ token: string; url: string }>(
				`/api/folders/${folder.id}/publish`,
				{ method: "POST" },
			);
			folder.visibility = "public";
			folder.public_token = res.token;
			await refreshNuxtData("folders");
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Publish failed",
			);
			return false;
		} finally {
			shareBusy.value = false;
		}
	}

	// Revoke a folder's public gallery — drops the token so any shared link 404s.
	async function unpublishFolder(folder: FolderNode): Promise<boolean> {
		shareBusy.value = true;
		try {
			await $fetch(`/api/folders/${folder.id}/unpublish`, { method: "POST" });
			folder.visibility = "private";
			folder.public_token = null;
			await refreshNuxtData("folders");
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ??
					"Unpublish failed",
			);
			return false;
		} finally {
			shareBusy.value = false;
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
		else if (type === "share") openShare(folder);
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
			await refreshNuxtData(["photos", "stats"]);
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
			await refreshNuxtData(["photos", "stats"]);
			toast.success(
				`Moved ${photoIds.length} photo${photoIds.length === 1 ? "" : "s"} to Trash`,
			);
			return true;
		} catch (err) {
			await refreshNuxtData(["photos", "stats"]);
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Delete failed",
			);
			return false;
		}
	}

	// ── Batch multi-select mutations ──────────────────────────────────────────────
	// Each mirrors its single-item counterpart but hits a dedicated batch endpoint
	// (one D1 write for the whole selection) and refreshes the relevant keys so the
	// Favorites / published / tag views + counts reflect the change immediately.

	// Set the favorite flag on every selected photo to an explicit value (not a
	// per-item toggle) so a bulk action is deterministic.
	async function bulkFavorite(ids: string[], value: boolean): Promise<boolean> {
		if (ids.length === 0) return false;
		try {
			await $fetch("/api/photos/favorite", {
				method: "POST",
				body: { ids, value },
			});
			await refreshNuxtData(["photos"]);
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Update failed",
			);
			return false;
		}
	}

	// Publish every not-yet-published photo in the selection (already-public rows
	// are left untouched — no token rotation). Reports how many were newly shared.
	async function bulkPublish(ids: string[]): Promise<boolean> {
		if (ids.length === 0) return false;
		try {
			const res = await $fetch<{ published: number }>("/api/photos/publish", {
				method: "POST",
				body: { ids },
			});
			await refreshNuxtData(["photos"]);
			toast.success(
				`Published ${res.published} photo${res.published === 1 ? "" : "s"}`,
			);
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Publish failed",
			);
			return false;
		}
	}

	// Revoke sharing for every selected photo (drops each token).
	async function bulkUnpublish(ids: string[]): Promise<boolean> {
		if (ids.length === 0) return false;
		try {
			const res = await $fetch<{ unpublished: number }>(
				"/api/photos/unpublish",
				{ method: "POST", body: { ids } },
			);
			await refreshNuxtData(["photos"]);
			toast.success(
				`Unpublished ${res.unpublished} photo${res.unpublished === 1 ? "" : "s"}`,
			);
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ??
					"Unpublish failed",
			);
			return false;
		}
	}

	// Attach one or more tags (by name — reused or created) to every selected
	// photo. Refreshes the tag list too (new tag / updated counts).
	async function bulkAttachTag(
		ids: string[],
		names: string[],
	): Promise<boolean> {
		if (ids.length === 0 || names.length === 0) return false;
		try {
			await $fetch("/api/photos/tags", {
				method: "POST",
				body: { ids, names },
			});
			await refreshNuxtData(["photos", "tags"]);
			toast.success(`Tagged ${ids.length} photo${ids.length === 1 ? "" : "s"}`);
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Update failed",
			);
			return false;
		}
	}

	// Restore every selected tombstoned photo back to the live library.
	async function bulkRestore(ids: string[]): Promise<boolean> {
		if (ids.length === 0) return false;
		try {
			const res = await $fetch<{ restored: number }>("/api/photos/restore", {
				method: "POST",
				body: { ids },
			});
			await refreshNuxtData(["photos", "stats"]);
			toast.success(
				`Restored ${res.restored} photo${res.restored === 1 ? "" : "s"}`,
			);
			return true;
		} catch (err) {
			toast.error(
				(err as { statusMessage?: string })?.statusMessage ?? "Restore failed",
			);
			return false;
		}
	}

	// ── Trash: restore / permanent delete / empty ────────────────────────────────
	// Restore a tombstoned photo back to the live library (clears deleted_at).
	async function restorePhoto(photo: Photo): Promise<boolean> {
		try {
			await $fetch(`/api/photos/${photo.id}/restore`, { method: "POST" });
			await refreshNuxtData(["photos", "stats"]);
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

	// ── Metadata edit ────────────────────────────────────────────────────────────
	// Persist an edit to a photo's user-facing metadata (EXIF text fields, iso,
	// filename). Mirrors toggleFavorite: single PATCH, then merge the returned row
	// in place for an instant reflect + refresh the list so counts/facets follow.
	async function updatePhoto(id: string, patch: Partial<Photo>): Promise<void> {
		try {
			await $fetch(`/api/photos/${id}`, { method: "PATCH", body: patch });
			await refreshNuxtData(["photos"]);
			toast.success("Changes saved");
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

	// Delete a tag entirely (its junction rows cascade). Drop it from the active
	// tag filter if it was selected.
	async function deleteTag(tag: Tag): Promise<void> {
		try {
			await $fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
			selectedTagIds.value = selectedTagIds.value.filter((id) => id !== tag.id);
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
		stats,
		selectedFolderId,
		favoritesOnly,
		selectedTagIds,
		trashOnly,
		selectedCamera,
		selectedLens,
		visibilityFilter,
		filterDateFrom,
		filterDateTo,
		activeFilterCount,
		clearFilters,
		monthScope,
		selectFolder,
		toggleFavorites,
		toggleTag,
		selectTrash,
		toggleCamera,
		toggleLens,
		selectMonth,
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
		// folder sharing
		shareTarget,
		shareBusy,
		openShare,
		folderShareUrl,
		publishFolder,
		unpublishFolder,
		// membership
		foldersOf,
		toggleMembership,
		addPhotosToFolder,
		removePhotosFromFolder,
		deletePhoto,
		bulkDelete,
		bulkFavorite,
		bulkPublish,
		bulkUnpublish,
		bulkAttachTag,
		bulkRestore,
		restorePhoto,
		purgePhoto,
		emptyTrash,
		toggleFavorite,
		updatePhoto,
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
