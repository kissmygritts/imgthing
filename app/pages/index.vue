<script setup lang="ts">
import {
	Check,
	CheckCheck,
	ChevronDown,
	ChevronLeft,
	FolderMinus,
	FolderPlus,
	Globe,
	Heart,
	ImageOff,
	Loader2,
	MoreVertical,
	RotateCcw,
	Share2,
	SlidersHorizontal,
	SquareCheckBig,
	Tag,
	Trash2,
	X,
} from "@lucide/vue";
import { refDebounced, useIntersectionObserver } from "@vueuse/core";
import FiltersSheet from "@/components/FiltersSheet.vue";
import PhotoViewer, { type Photo } from "@/components/PhotoViewer.vue";
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
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { TagsInput } from "@/components/ui/tags-input";
import { monthRange } from "@/lib/date";

interface PhotosResponse {
	photos: Photo[];
	total: number;
	limit: number;
	offset: number;
}

const {
	folders,
	tags,
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
	search,
	currentTitle,
	foldersOf,
	toggleMembership,
	toggleFavorite,
	updatePhoto,
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
	attachTag,
	detachTag,
	publishPhoto,
	unpublishPhoto,
} = useLibrary();

// ── Search + sort now drive the server query ──────────────────────────────
type SortMode = "newest" | "oldest" | "name" | "size_desc" | "size_asc";
const sortMode = ref<SortMode>("newest");
const sortLabels: Record<SortMode, string> = {
	newest: "Newest first",
	oldest: "Oldest first",
	name: "Filename A–Z",
	size_desc: "Largest",
	size_asc: "Smallest",
};

const PAGE_SIZE = 50;
// Debounce the search box so keystrokes don't hammer the endpoint.
const debouncedSearch = refDebounced(search, 300);
const activeSearch = computed(() => debouncedSearch.value.trim());

// The Filters sheet's open state — a single boolean, no local draft: every
// control inside binds straight to useLibrary() filter state, so opening/
// closing the sheet never affects what's actually applied.
const filtersOpen = ref(false);

// The reactive query for the *first* page. Changing scope/filters/search/sort
// refetches from offset 0; infinite scroll then appends further pages with the
// same query. Scope (month/trash/folder) stays an exclusive if/else-if chain;
// filters layer on top unconditionally so they AND together regardless of
// which scope is active.
const listQuery = computed(() => {
	const query: Record<string, string> = {
		sort: sortMode.value,
		limit: String(PAGE_SIZE),
	};
	if (monthScope.value) {
		// Month scope enters the gallery constrained to one capture month via the
		// half-open range from monthRange (the single source of boundary truth).
		const { from, to } = monthRange(monthScope.value);
		query.from = from;
		query.to = to;
	} else if (trashOnly.value) query.deleted = "1";
	else if (selectedFolderId.value !== null)
		query.folderId = selectedFolderId.value;

	if (favoritesOnly.value) query.favorite = "1";
	if (selectedTagIds.value.length) query.tags = selectedTagIds.value.join(",");
	if (selectedCamera.value) query.camera = selectedCamera.value;
	if (selectedLens.value) query.lens = selectedLens.value;
	if (visibilityFilter.value !== "any")
		query.visibility = visibilityFilter.value;
	if (filterDateFrom.value) query.dateFrom = filterDateFrom.value;
	if (filterDateTo.value) query.dateTo = filterDateTo.value;
	if (activeSearch.value) query.q = activeSearch.value;
	return query;
});

// Photos are the page's primary (SSR-critical) content, so fetch + await here.
// The keyed request lets mutations elsewhere refresh page 0 via refreshNuxtData.
// `useRequestFetch` forwards the incoming request's cookies during SSR — plain
// `$fetch` would not, so the server-side call to the auth-guarded `/api/photos`
// would 401 and the grid would render empty until a client-side query change.
const requestFetch = useRequestFetch();
const { data } = await useAsyncData(
	"photos",
	() =>
		requestFetch<PhotosResponse>("/api/photos", {
			query: { ...listQuery.value, offset: 0 },
		}),
	{ watch: [listQuery] },
);

// Accumulated, infinite-scroll list. Whenever page 0 (re)loads — filter change or
// a mutation refresh — reset the accumulation to it.
const photos = ref<Photo[]>([]);
const total = ref(0);
watch(
	data,
	(d) => {
		if (!d) return;
		photos.value = d.photos;
		total.value = d.total;
	},
	{ immediate: true },
);

const hasMore = computed(() => photos.value.length < total.value);
const loadingMore = ref(false);

async function loadMore() {
	if (loadingMore.value || !hasMore.value) return;
	loadingMore.value = true;
	try {
		const res = await $fetch<PhotosResponse>("/api/photos", {
			query: { ...listQuery.value, offset: photos.value.length },
		});
		photos.value = photos.value.concat(res.photos);
		total.value = res.total;
	} finally {
		loadingMore.value = false;
	}
}

// IntersectionObserver sentinel at the end of the grid.
const sentinel = ref<HTMLElement | null>(null);
useIntersectionObserver(sentinel, (entries) => {
	if (entries[0]?.isIntersecting) loadMore();
});

// ── Multi-select ───────────────────────────────────────────────────────────
// A contextual mode: toggle it on, click tiles to (de)select, shift-click for a
// range. The action bar only appears once something is selected, so the gallery
// stays uncluttered at rest. Changing the query (folder/search/sort) resets the
// accumulated `photos`, so we clear the selection with it to avoid stale ids.
const selectMode = ref(false);
const selectedIds = ref<Set<string>>(new Set());
const lastIndex = ref<number | null>(null);
const selectedCount = computed(() => selectedIds.value.size);
const selectedPhotoIds = computed(() => [...selectedIds.value]);

// The bulk bar is teleported to <body> and pinned to the viewport (see the
// template note), so `left-1/2` centers it on the whole window, not the glass
// panel. When the sidebar is present (desktop + expanded) the panel is inset by
// its width, so nudge the bar right by half that width to sit centered over the
// panel instead. Offcanvas/mobile → panel is full width → no offset.
const { state: sidebarState, isMobile } = useSidebar();
const bulkBarLeft = computed(() =>
	!isMobile.value && sidebarState.value === "expanded"
		? "calc(50% + 8rem)"
		: "50%",
);

function isSelected(id: string) {
	return selectedIds.value.has(id);
}

function toggleSelect(i: number, ev?: MouseEvent) {
	const photo = photos.value[i];
	if (!photo) return;
	const next = new Set(selectedIds.value);
	if (ev?.shiftKey && lastIndex.value !== null) {
		const a = Math.min(lastIndex.value, i);
		const b = Math.max(lastIndex.value, i);
		for (let k = a; k <= b; k++) {
			const p = photos.value[k];
			if (p) next.add(p.id);
		}
	} else if (next.has(photo.id)) {
		next.delete(photo.id);
	} else {
		next.add(photo.id);
	}
	selectedIds.value = next;
	lastIndex.value = i;
}

function clearSelection() {
	selectedIds.value = new Set();
	lastIndex.value = null;
}

function exitSelect() {
	selectMode.value = false;
	clearSelection();
}

function selectAll() {
	selectedIds.value = new Set(photos.value.map((p) => p.id));
}

// A filter/sort change reflows the grid — drop any stale selection.
watch(listQuery, clearSelection);

async function bulkAddToFolder(folderId: string) {
	if (await addPhotosToFolder(selectedPhotoIds.value, folderId)) exitSelect();
}
async function bulkRemoveFromFolder(folderId: string) {
	if (await removePhotosFromFolder(selectedPhotoIds.value, folderId))
		exitSelect();
}

const confirmBulkDelete = ref(false);
const bulkDeleting = ref(false);
async function runBulkDelete() {
	bulkDeleting.value = true;
	try {
		const ok = await bulkDelete(selectedPhotoIds.value);
		confirmBulkDelete.value = false;
		if (ok) exitSelect();
	} finally {
		bulkDeleting.value = false;
	}
}

// ── Batch actions on the current selection ────────────────────────────────
// Favorite is a deterministic set-all, not a per-item flip: the first click
// favorites the whole selection, the next un-favorites it. Any change to the
// selection resets the intent to false (a mixed set is treated as un-favorited).
const bulkFavorited = ref(false);
watch(selectedIds, () => {
	bulkFavorited.value = false;
});
async function bulkFavoriteSelected() {
	const value = !bulkFavorited.value;
	if (await bulkFavorite(selectedPhotoIds.value, value))
		bulkFavorited.value = value;
}

// Publish/unpublish/restore mirror the delete flow: clear the selection on
// success (favorite deliberately keeps it so the toggle stays reachable).
async function bulkPublishSelected() {
	if (await bulkPublish(selectedPhotoIds.value)) exitSelect();
}
async function bulkUnpublishSelected() {
	if (await bulkUnpublish(selectedPhotoIds.value)) exitSelect();
}
async function bulkRestoreSelected() {
	if (await bulkRestore(selectedPhotoIds.value)) exitSelect();
}

// Batch tag entry — same TagsInput used on a single photo, but selected
// photos can carry different tags already, so there's no sensible starting
// chip set: it always opens empty, and whatever's added here gets attached to
// every selected photo on submit. Lives in a small dialog so the bulk bar
// stays compact.
const tagDialogOpen = ref(false);
const bulkTagNames = ref<string[]>([]);
const bulkTagging = ref(false);
function openBulkTag() {
	bulkTagNames.value = [];
	tagDialogOpen.value = true;
}
function onBulkAddTag(name: string) {
	if (!bulkTagNames.value.some((t) => t.toLowerCase() === name.toLowerCase()))
		bulkTagNames.value.push(name);
}
function onBulkRemoveTag(name: string) {
	bulkTagNames.value = bulkTagNames.value.filter((t) => t !== name);
}
async function runBulkTag() {
	if (bulkTagNames.value.length === 0) return;
	bulkTagging.value = true;
	try {
		const ok = await bulkAttachTag(selectedPhotoIds.value, bulkTagNames.value);
		if (ok) {
			tagDialogOpen.value = false;
			exitSelect();
		}
	} finally {
		bulkTagging.value = false;
	}
}

// ── Trash: per-tile restore / permanent delete + empty ─────────
// A tombstoned photo leaves the current (trash) list when restored or purged, so
// both refresh the grid; the confirm dialog gates the destructive permanent purge.
const purgeTarget = ref<Photo | null>(null);
const purging = ref(false);
async function runPurge() {
	const target = purgeTarget.value;
	if (!target) return;
	purging.value = true;
	try {
		await purgePhoto(target);
		purgeTarget.value = null;
	} finally {
		purging.value = false;
	}
}

const confirmEmptyTrash = ref(false);
const emptying = ref(false);
async function runEmptyTrash() {
	emptying.value = true;
	try {
		await emptyTrash();
		confirmEmptyTrash.value = false;
	} finally {
		emptying.value = false;
	}
}

const viewerIndex = ref<number | null>(null);
function openViewer(i: number) {
	viewerIndex.value = i;
}

// Heart toggle from inside the viewer — find the row and route through the
// composable (optimistic flip + list refresh).
function onViewerFavorite(id: string) {
	const photo = photos.value.find((p) => p.id === id);
	if (photo) toggleFavorite(photo);
}

// Share (publish/unpublish) from the viewer — mirror the favorite treatment:
// find the row and route through the composable, which mutates the row's
// visibility/token in place and refreshes the list.
function onViewerPublish(id: string, showLocation: boolean) {
	const photo = photos.value.find((p) => p.id === id);
	if (photo) publishPhoto(photo, showLocation);
}
function onViewerUnpublish(id: string) {
	const photo = photos.value.find((p) => p.id === id);
	if (photo) unpublishPhoto(photo);
}

// Tag attach/detach from the viewer drawer — route through the composable, which
// persists and refreshes the photo list (updating this row's tag_ids).
function onViewerAttachTag(id: string, name: string) {
	const photo = photos.value.find((p) => p.id === id);
	if (photo) attachTag(photo, name);
}
function onViewerDetachTag(id: string, tagId: string) {
	const photo = photos.value.find((p) => p.id === id);
	if (photo) detachTag(photo, tagId);
}

// Any viewer action that removes the visible photo from the current list (soft
// delete, restore, or permanent purge) shares the same after-step: once the list
// shrinks, keep the viewer on the photo that slid into this slot, clamp to the
// last one, or close if nothing is left.
async function afterViewerRemoval(ok: boolean) {
	if (!ok) return;
	await nextTick();
	const count = photos.value.length;
	if (count === 0 || viewerIndex.value === null) {
		viewerIndex.value = null;
	} else if (viewerIndex.value > count - 1) {
		viewerIndex.value = count - 1;
	}
}

async function onViewerDelete(id: string) {
	const photo = photos.value.find((p) => p.id === id);
	if (!photo) return;
	await afterViewerRemoval(await deletePhoto(photo));
}

// Trash viewer: restore back to the library, or permanently purge (R2 + D1).
async function onViewerRestore(id: string) {
	const photo = photos.value.find((p) => p.id === id);
	if (!photo) return;
	await afterViewerRemoval(await restorePhoto(photo));
}
async function onViewerPurge(id: string) {
	const photo = photos.value.find((p) => p.id === id);
	if (!photo) return;
	await afterViewerRemoval(await purgePhoto(photo));
}
</script>

<template>
	<div class="flex flex-1 flex-col gap-6">
		<header
			class="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-border pb-5"
		>
			<div class="min-w-0 flex-1">
				<!-- When scoped to a month, the title links back to the calendar. -->
				<NuxtLink
					v-if="monthScope"
					to="/calendar"
					class="group inline-flex max-w-full items-center gap-1.5 text-foreground transition-colors hover:text-primary"
				>
					<ChevronLeft
						class="size-6 shrink-0 -translate-x-0.5 text-muted-foreground transition-transform group-hover:-translate-x-1.5 group-hover:text-primary"
					/>
					<span class="truncate font-serif text-3xl font-normal tracking-tight">
						{{ currentTitle }}
					</span>
				</NuxtLink>
				<h1
					v-else
					class="truncate font-serif text-3xl font-normal tracking-tight text-foreground"
				>
					{{ currentTitle }}
				</h1>
				<p class="mt-1 text-sm tabular-nums text-muted-foreground">
					{{ total }} photo{{ total === 1 ? "" : "s" }}
					<span v-if="activeSearch || activeFilterCount"> · filtered</span>
				</p>
			</div>

			<div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
				<button
					v-if="trashOnly && photos.length"
					class="flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/15"
					@click="confirmEmptyTrash = true"
				>
					<Trash2 class="size-3.5 opacity-80" />
					Empty trash
				</button>
				<button
					v-if="!trashOnly || photos.length"
					class="flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors"
					:class="
						selectMode
							? 'border-primary/40 bg-primary/15 text-accent-foreground'
							: 'border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 text-muted-foreground hover:text-foreground'
					"
					@click="selectMode ? exitSelect() : (selectMode = true)"
				>
					<SquareCheckBig class="size-3.5 opacity-80" />
					{{ selectMode ? "Done" : "Select" }}
				</button>

				<div class="relative">
					<button
						class="relative flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors"
						:class="
							activeFilterCount
								? 'border-primary/40 bg-primary/15 text-accent-foreground'
								: 'border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 text-muted-foreground hover:text-foreground'
						"
						@click="filtersOpen = true"
					>
						<SlidersHorizontal class="size-3.5 opacity-80" />
						Filters
						<span
							v-if="activeFilterCount"
							class="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold tabular-nums text-primary-foreground"
						>
							{{ activeFilterCount }}
						</span>
					</button>
					<button
						v-if="activeFilterCount"
						title="Clear filters"
						aria-label="Clear filters"
						class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-white/70 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground dark:border-white/12"
						@click.stop="clearFilters"
					>
						<X class="size-3" />
					</button>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger as-child>
						<button
							class="flex items-center gap-2 rounded-full border border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:text-foreground"
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
							<DropdownMenuRadioItem value="size_desc">Largest</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="size_asc">Smallest</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</header>

		<section
			v-if="photos.length"
			class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
		>
			<figure
				v-for="(photo, i) in photos"
				:key="photo.id"
				class="group relative aspect-square overflow-hidden rounded-[20px] shadow-lg transition-transform duration-300 hover:-translate-y-1"
				:class="isSelected(photo.id) && 'ring-2 ring-primary ring-offset-2 ring-offset-background'"
			>
				<img
					:src="`/api/photos/${photo.id}/variant?size=thumb`"
					:alt="photo.original_filename"
					loading="lazy"
					class="absolute inset-0 size-full cursor-pointer object-cover"
					@click="selectMode ? toggleSelect(i, $event) : openViewer(i)"
				/>

				<!-- selection tint (the boundary indicator is the ring-2 above) -->
				<span
					v-if="isSelected(photo.id)"
					class="pointer-events-none absolute inset-0 z-[5] rounded-[20px] bg-primary/15"
				/>

				<!-- selection checkbox (visible in select mode) -->
				<button
					v-if="selectMode"
					class="absolute left-2 top-2 z-10 flex size-6 items-center justify-center rounded-full border shadow-sm transition"
					:class="
						isSelected(photo.id)
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-white/70 dark:border-white/12 bg-white/40 dark:bg-white/8 text-transparent backdrop-blur'
					"
					:title="isSelected(photo.id) ? 'Deselect' : 'Select'"
					@click.stop="toggleSelect(i, $event)"
				>
					<Check class="size-3.5" />
				</button>

				<!-- Trash tile actions: restore (left) + delete forever (right) -->
				<button
					v-if="!selectMode && trashOnly"
					class="absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border border-white/70 dark:border-white/12 bg-white/40 dark:bg-white/8 text-white opacity-0 backdrop-blur transition hover:bg-white/60 dark:hover:bg-white/15 group-hover:opacity-100"
					title="Restore"
					@click.stop="restorePhoto(photo)"
				>
					<RotateCcw class="size-4" />
				</button>
				<button
					v-if="!selectMode && trashOnly"
					class="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border border-white/70 dark:border-white/12 bg-white/40 dark:bg-white/8 text-white opacity-0 backdrop-blur transition hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
					title="Delete forever"
					@click.stop="purgeTarget = photo"
				>
					<Trash2 class="size-4" />
				</button>

				<!-- favorite heart — always shown when hearted, else on hover -->
				<button
					v-if="!selectMode && !trashOnly"
					class="absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border border-white/70 dark:border-white/12 bg-white/40 dark:bg-white/8 backdrop-blur transition hover:bg-white/60 dark:hover:bg-white/15"
					:class="
						photo.is_favorite
							? 'text-rose-500 opacity-100'
							: 'text-white opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100'
					"
					:title="photo.is_favorite ? 'Remove from favorites' : 'Add to favorites'"
					@click.stop="toggleFavorite(photo)"
				>
					<Heart class="size-4" :class="photo.is_favorite ? 'fill-current' : ''" />
				</button>

				<!-- public indicator — globe badge, always shown when published.
				     Placeholder placement/styling (final polish is P7b). -->
				<span
					v-if="!trashOnly && photo.visibility === 'public'"
					class="pointer-events-none absolute bottom-2 right-2 z-10 flex size-6 items-center justify-center rounded-full border border-white/70 dark:border-white/12 bg-white/40 dark:bg-white/8 text-white backdrop-blur"
					title="Public"
				>
					<Globe class="size-3.5" />
				</span>

				<!-- signature prism rim (direct child of .group) -->
				<span class="prism-edge" />
				<span
					class="pointer-events-none absolute inset-0 rounded-[20px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
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
				<DropdownMenu v-if="!selectMode && !trashOnly">
					<DropdownMenuTrigger as-child>
						<button
							class="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border border-white/70 dark:border-white/12 bg-white/40 dark:bg-white/8 text-white opacity-0 backdrop-blur transition hover:bg-white/60 dark:hover:bg-white/15 group-hover:opacity-100 data-[state=open]:opacity-100"
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
					{{
						activeSearch || activeFilterCount
							? "No matches"
							: trashOnly
								? "Trash is empty"
								: "No photos here"
					}}
				</p>
				<p class="text-sm text-muted-foreground">
					{{
						activeSearch || activeFilterCount
							? "Try a different search or adjust your filters."
							: trashOnly
								? "Deleted photos land here — restore them or clear them out for good."
								: "Upload an image or add photos to this folder."
					}}
				</p>
			</div>
		</section>

		<!-- Infinite-scroll sentinel + loading indicator -->
		<div
			v-if="hasMore"
			ref="sentinel"
			class="flex items-center justify-center py-8 text-sm text-muted-foreground"
		>
			<Loader2 v-if="loadingMore" class="size-4 animate-spin" />
		</div>

		<!-- Filters sheet -->
		<FiltersSheet v-model:open="filtersOpen" />

		<!-- Photo viewer / lightbox -->
		<PhotoViewer
			v-if="viewerIndex !== null"
			:photos="photos"
			:index="viewerIndex"
			:all-tags="tags"
			:trash="trashOnly"
			@update:index="viewerIndex = $event"
			@close="viewerIndex = null"
			@save="updatePhoto"
			@delete="onViewerDelete"
			@restore="onViewerRestore"
			@purge="onViewerPurge"
			@favorite="onViewerFavorite"
			@publish="onViewerPublish"
			@unpublish="onViewerUnpublish"
			@attach-tag="onViewerAttachTag"
			@detach-tag="onViewerDetachTag"
		/>

		<!-- Contextual bulk-action bar — only present once photos are selected.
		     Teleported to <body>: the floating panel's backdrop-filter would
		     otherwise capture position:fixed and pin the bar to the tall panel
		     (off-screen) instead of the viewport. The fixed positioning lives on
		     the outer wrapper; .glass-panel (unlayered, position:relative) rides
		     the inner element so it can't override the fixed placement. -->
		<Teleport to="body">
		<Transition
			enter-active-class="transition duration-200 ease-out"
			enter-from-class="translate-y-4 opacity-0"
			leave-active-class="transition duration-150 ease-in"
			leave-to-class="translate-y-4 opacity-0"
		>
			<div
				v-if="selectMode && selectedCount"
				class="fixed bottom-6 z-[60] -translate-x-1/2 transition-[left] duration-200 ease-linear"
				:style="{ left: bulkBarLeft }"
			>
			<div
				class="glass-panel flex max-w-[calc(100vw-1rem)] items-center gap-1 overflow-x-auto rounded-full py-2 pl-4 pr-2 text-sm sm:gap-1.5 [&>*]:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				<span class="mr-1 whitespace-nowrap font-semibold tabular-nums text-foreground">
					{{ selectedCount }} selected
				</span>

				<button
					class="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-2.5"
					title="Select all"
					@click="selectAll"
				>
					<CheckCheck class="size-3.5" /><span class="hidden sm:inline">All</span>
				</button>

				<span class="mx-0.5 h-5 w-px bg-border" />

				<!-- Trash view: the only bulk action is restore -->
				<button
					v-if="trashOnly"
					class="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/50 dark:hover:bg-white/10 sm:px-3"
					title="Restore"
					@click="bulkRestoreSelected"
				>
					<RotateCcw class="size-4" /><span class="hidden sm:inline">Restore</span>
				</button>

				<template v-else>
					<!-- Favorite the whole selection (toggles set-all-true / set-all-false) -->
					<button
						class="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold transition-colors hover:bg-white/50 dark:hover:bg-white/10 sm:px-3"
						:class="bulkFavorited ? 'text-rose-500' : 'text-foreground'"
						:title="bulkFavorited ? 'Remove from favorites' : 'Add to favorites'"
						@click="bulkFavoriteSelected"
					>
						<Heart class="size-4" :class="bulkFavorited && 'fill-current'" /><span class="hidden sm:inline">Favorite</span>
					</button>

					<!-- Publish / unpublish the selection -->
					<DropdownMenu>
						<DropdownMenuTrigger as-child>
							<button
								class="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/50 dark:hover:bg-white/10 sm:px-3"
								title="Public sharing"
							>
								<Share2 class="size-4" /><span class="hidden sm:inline">Share</span>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="center" side="top" :side-offset="10" class="z-[70] min-w-44">
							<DropdownMenuLabel>Public sharing</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem @select="bulkPublishSelected">
								<Globe class="size-4" /> Publish
							</DropdownMenuItem>
							<DropdownMenuItem @select="bulkUnpublishSelected">
								<X class="size-4" /> Unpublish
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<!-- Tag the selection -->
					<button
						class="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/50 dark:hover:bg-white/10 sm:px-3"
						title="Add tag"
						@click="openBulkTag"
					>
						<Tag class="size-4" /><span class="hidden sm:inline">Tag</span>
					</button>

					<!-- Add selected → folder -->
					<DropdownMenu>
						<DropdownMenuTrigger as-child>
							<button
								class="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/50 dark:hover:bg-white/10 sm:px-3"
								title="Add to folder"
							>
								<FolderPlus class="size-4" /><span class="hidden sm:inline">Add</span>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="center" side="top" :side-offset="10" class="z-[70] min-w-44">
							<DropdownMenuLabel>Add to folder</DropdownMenuLabel>
							<template v-if="folders.length">
								<DropdownMenuSeparator />
								<DropdownMenuItem
									v-for="folder in folders"
									:key="folder.id"
									@select="bulkAddToFolder(folder.id)"
								>
									{{ folder.name }}
								</DropdownMenuItem>
							</template>
							<p v-else class="px-2 py-1.5 text-xs text-muted-foreground">
								Create a folder first
							</p>
						</DropdownMenuContent>
					</DropdownMenu>

					<!-- Remove selected from folder -->
					<DropdownMenu>
						<DropdownMenuTrigger as-child>
							<button
								class="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/50 dark:hover:bg-white/10 sm:px-3"
								title="Remove from folder"
							>
								<FolderMinus class="size-4" /><span class="hidden sm:inline">Remove</span>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="center" side="top" :side-offset="10" class="z-[70] min-w-44">
							<DropdownMenuLabel>Remove from folder</DropdownMenuLabel>
							<template v-if="folders.length">
								<DropdownMenuSeparator />
								<DropdownMenuItem
									v-for="folder in folders"
									:key="folder.id"
									@select="bulkRemoveFromFolder(folder.id)"
								>
									{{ folder.name }}
								</DropdownMenuItem>
							</template>
							<p v-else class="px-2 py-1.5 text-xs text-muted-foreground">
								No folders yet
							</p>
						</DropdownMenuContent>
					</DropdownMenu>

					<button
						class="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 sm:px-3"
						title="Move to Trash"
						@click="confirmBulkDelete = true"
					>
						<Trash2 class="size-4" /><span class="hidden sm:inline">Delete</span>
					</button>
				</template>

				<button
					class="ml-0.5 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/50 dark:hover:bg-white/10 hover:text-foreground"
					title="Clear selection"
					@click="exitSelect"
				>
					<X class="size-4" />
				</button>
			</div>
			</div>
		</Transition>
		</Teleport>

		<!-- Bulk delete confirm -->
		<Dialog
			:open="confirmBulkDelete"
			@update:open="(v) => !v && (confirmBulkDelete = false)"
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						Move {{ selectedCount }} photo{{ selectedCount === 1 ? "" : "s" }} to Trash?
					</DialogTitle>
					<DialogDescription>
						The selected photo{{ selectedCount === 1 ? "" : "s" }} move to Trash. You
						can restore {{ selectedCount === 1 ? "it" : "them" }} later, or empty the
						Trash to remove {{ selectedCount === 1 ? "it" : "them" }} for good.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" @click="confirmBulkDelete = false">Cancel</Button>
					<Button
						variant="destructive"
						:disabled="bulkDeleting"
						@click="runBulkDelete"
					>
						<Loader2 v-if="bulkDeleting" class="size-4 animate-spin" />
						Move to Trash
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>

		<!-- Batch tag entry -->
		<Dialog
			:open="tagDialogOpen"
			@update:open="(v) => !v && (tagDialogOpen = false)"
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						Tag {{ selectedCount }} photo{{ selectedCount === 1 ? "" : "s" }}
					</DialogTitle>
					<DialogDescription>
						Add one or more tags to every selected photo. Press Enter after each
						one — new tags are created automatically.
					</DialogDescription>
				</DialogHeader>
				<form class="flex flex-col gap-2" @submit.prevent="runBulkTag">
					<TagsInput
						:model-value="bulkTagNames"
						:suggestions="tags.map((t) => t.name)"
						placeholder="Add a tag"
						auto-focus
						@add="onBulkAddTag"
						@remove="onBulkRemoveTag"
					/>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							@click="tagDialogOpen = false"
						>
							Cancel
						</Button>
						<Button type="submit" :disabled="bulkTagging || bulkTagNames.length === 0">
							<Loader2 v-if="bulkTagging" class="size-4 animate-spin" />
							Add tags
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>

		<!-- Permanent (per-photo) purge confirm -->
		<Dialog
			:open="!!purgeTarget"
			@update:open="(v) => !v && (purgeTarget = null)"
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete this photo forever?</DialogTitle>
					<DialogDescription>
						“{{ purgeTarget?.original_filename }}” and its metadata will be
						permanently removed. This can’t be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" @click="purgeTarget = null">Cancel</Button>
					<Button variant="destructive" :disabled="purging" @click="runPurge">
						<Loader2 v-if="purging" class="size-4 animate-spin" />
						Delete forever
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>

		<!-- Empty trash confirm -->
		<Dialog
			:open="confirmEmptyTrash"
			@update:open="(v) => !v && (confirmEmptyTrash = false)"
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Empty the Trash?</DialogTitle>
					<DialogDescription>
						Every photo in the Trash is permanently removed, along with its
						metadata and folder/tag memberships. This can’t be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" @click="confirmEmptyTrash = false">Cancel</Button>
					<Button variant="destructive" :disabled="emptying" @click="runEmptyTrash">
						<Loader2 v-if="emptying" class="size-4 animate-spin" />
						Empty trash
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	</div>
</template>
