<script setup lang="ts">
import {
	ArrowLeft,
	Check,
	ChevronLeft,
	ChevronRight,
	Copy,
	Download,
	Globe,
	Heart,
	Keyboard,
	MoreHorizontal,
	PanelRightClose,
	PanelRightOpen,
	Pencil,
	Plus,
	RotateCcw,
	Share2,
	Trash2,
	X,
} from "@lucide/vue";
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
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

// Mirrors the row shape returned by GET /api/photos.
export interface Photo {
	id: string;
	original_filename: string;
	content_type: string | null;
	file_size: number | null;
	uploaded_at: string;
	camera_make: string | null;
	camera_model: string | null;
	lens_info: string | null;
	exposure: string | null;
	aperture: string | null;
	iso: number | null;
	focal_length: string | null;
	taken_at: string | null;
	gps_latitude: number | null;
	gps_longitude: number | null;
	folder_ids: string | null;
	// Comma-joined tag ids the photo carries (GROUP_CONCAT), resolved to names
	// via the `allTags` list. Null when the photo has no tags.
	tag_ids: string | null;
	is_favorite: number;
	// Public sharing (P4 backend). visibility flips to 'public' on publish, which
	// mints public_token; the tokened URLs are `${origin}/p/${token}/${size}`.
	// show_location gates whether GPS is exposed on the public meta endpoint.
	visibility: string;
	public_token: string | null;
	show_location: number;
}

// A tag as returned by GET /api/tags.
export interface Tag {
	id: string;
	name: string;
	photo_count?: number;
}

const props = defineProps<{
	photos: Photo[];
	index: number;
	// The full tag list, for rendering chips + autocompleting the add field.
	allTags: Tag[];
	// Trash mode: the visible photos are tombstoned, so the actions swap from
	// "move to Trash" to Restore + Delete forever (permanent purge).
	trash?: boolean;
}>();

const emit = defineEmits<{
	close: [];
	"update:index": [value: number];
	// Emitted when the metadata drawer saves an edit. No PATCH endpoint exists
	// yet — the parent is responsible for persisting the patch.
	save: [id: string, patch: Partial<Photo>];
	// Emitted (after confirm) to delete a photo. In the normal library this is a
	// soft delete (move to Trash); the parent performs the request, refreshes the
	// list, and advances nav / closes the viewer.
	delete: [id: string];
	// Trash-only: restore a tombstoned photo back to the library.
	restore: [id: string];
	// Trash-only (after confirm): permanently purge a tombstoned photo.
	purge: [id: string];
	// Emitted to toggle the favorite flag. The parent persists + refreshes.
	favorite: [id: string];
	// Emitted to publish a photo for public sharing. showLocation gates GPS in the
	// public meta endpoint; re-publishing (incl. a show_location change) rotates
	// the token. The parent persists + updates the row's visibility/public_token.
	publish: [id: string, showLocation: boolean];
	// Emitted to revoke a public share (drops the token → shared URLs 404).
	unpublish: [id: string];
	// Emitted to attach a tag (by name — reused or created) to a photo.
	"attach-tag": [id: string, name: string];
	// Emitted to detach a tag (by id) from a photo.
	"detach-tag": [id: string, tagId: string];
}>();

const photo = computed(() => props.photos[props.index] ?? null);

// Drawer + editing state. The drawer is open by default on desktop; collapsing
// it hands the whole stage to the image. On a phone it starts closed so the
// full-width drawer doesn't bury the photo — the reader taps Details to open it.
// (This component only ever mounts client-side, on tile click, so reading the
// viewport width here is safe.)
const drawerOpen = ref(import.meta.client ? window.innerWidth >= 768 : true);
const mode = ref<"view" | "edit" | "share">("view");

function prev() {
	if (props.index > 0) emit("update:index", props.index - 1);
}
function next() {
	if (props.index < props.photos.length - 1)
		emit("update:index", props.index + 1);
}

function isTypingTarget(el: EventTarget | null): boolean {
	return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

// --- Keyboard-shortcut help overlay --------------------------------------
// The viewer shortcuts are undiscoverable, so `?` (and a button) opens a Dialog
// listing them. The list below is rendered verbatim in the overlay and MUST
// stay in sync with onKeydown — one source of truth for the real bindings.
const helpOpen = ref(false);

const shortcuts: { keys: string[]; action: string }[] = [
	{ keys: ["←"], action: "Previous photo" },
	{ keys: ["→"], action: "Next photo" },
	{ keys: ["i"], action: "Toggle details" },
	{ keys: ["Esc"], action: "Back / close viewer" },
	{ keys: ["?"], action: "Keyboard shortcuts" },
];

function onKeydown(e: KeyboardEvent) {
	// While the help overlay is open it owns the keyboard: `?`/`Esc` close it and
	// every other binding is inert, so viewer nav/close never fires underneath in
	// the same keypress (the Dialog handles focus-trap + backdrop close itself).
	if (helpOpen.value) {
		if (e.key === "?" || e.key === "Escape") {
			helpOpen.value = false;
			e.preventDefault();
		}
		return;
	}
	if (e.key === "Escape") {
		// Esc backs out of a sub-screen first, then closes the viewer.
		if (mode.value === "edit") cancelEdit();
		else if (mode.value === "share") mode.value = "view";
		else emit("close");
		return;
	}
	// Don't hijack keys while editing a field.
	if (isTypingTarget(e.target)) return;
	if (e.key === "?") {
		// Shift+/ — open the help overlay.
		helpOpen.value = true;
		return;
	}
	if (e.key === "ArrowLeft") prev();
	else if (e.key === "ArrowRight") next();
	else if (e.key === "i") drawerOpen.value = !drawerOpen.value;
}

onMounted(() => {
	window.addEventListener("keydown", onKeydown);
	document.body.style.overflow = "hidden";
	// Absolute origin so the share screen's public URLs are copy-paste ready.
	origin.value = window.location.origin;
});
onUnmounted(() => {
	window.removeEventListener("keydown", onKeydown);
	document.body.style.overflow = "";
	clearTimeout(copyTimer);
});

function formatDate(iso: string | null): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? null
		: d.toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
}

// [label, value] rows for the editorial fact list, in a fixed order. Missing
// values render as an em dash so the panel keeps its instrument-panel rhythm.
const facts = computed(() => {
	const p = photo.value;
	if (!p) return [];
	const camera = [p.camera_make, p.camera_model].filter(Boolean).join(" ");
	const rows: [string, string | null][] = [
		["Camera", camera || null],
		["Lens", p.lens_info],
		["Focal length", p.focal_length],
		["ISO", p.iso != null ? `ISO ${p.iso}` : null],
		["Shutter", p.exposure],
		["Aperture", p.aperture],
		["Date", formatDate(p.taken_at) ?? formatDate(p.uploaded_at)],
	];
	return rows;
});

// --- Share & embed screen -----------------------------------------------
// One public surface: toggle the photo public, then surface its tokened
// `/p/{token}/{size}` URLs + copy-paste embed snippets. These are the *only*
// portable URLs — the private `/api/photos/{id}/variant` route only serves a
// logged-in owner, so it's never handed out for embedding. Just the three WebP
// renditions are exposed; the original and its EXIF stay private.
const origin = ref("");

// The three public renditions (longest side, px). No `raw` — the original is
// never served publicly.
const publicSizes = [
	{ key: "thumb", width: 800, label: "Thumb" },
	{ key: "md", width: 1280, label: "Medium" },
	{ key: "lg", width: 2560, label: "Large" },
] as const;

// A tokened public URL for a size, or "" while the photo is private (no token).
function publicUrl(size: string): string {
	const t = photo.value?.public_token;
	return t ? `${origin.value}/p/${t}/${size}` : "";
}

// Copyable URL rows — only meaningful once published (token exists).
const sizeRows = computed(() =>
	publicSizes.map((s) => ({
		key: s.key,
		name: s.key,
		meta: `${s.width}px`,
		url: publicUrl(s.key),
	})),
);

// Copy-paste snippets, medium as the sensible default single-size embed.
const snippets = computed(() => {
	const name = photo.value?.original_filename ?? "";
	return [
		{
			key: "html",
			label: "HTML",
			code: `<img src="${publicUrl("md")}" alt="${name}" />`,
		},
		{
			key: "markdown",
			label: "Markdown",
			code: `![${name}](${publicUrl("md")})`,
		},
		{
			key: "srcset",
			label: "Responsive",
			code: `<img
  src="${publicUrl("md")}"
  srcset="${publicUrl("thumb")} 800w,
          ${publicUrl("md")} 1280w,
          ${publicUrl("lg")} 2560w"
  sizes="(max-width: 768px) 100vw, 768px"
  alt="${name}"
/>`,
		},
		{
			key: "meta-curl",
			label: "Metadata (cURL)",
			code: `curl ${publicUrl("meta")}`,
		},
		{
			key: "meta-js",
			label: "Metadata (JSON)",
			code: `const res = await fetch("${publicUrl("meta")}");
const exif = await res.json();
// { filename, takenAt, camera, lens, exposure,
//   aperture, iso, focalLength, publishedAt, gps }`,
		},
	];
});

// Which row/snippet most recently copied, for the transient check icon.
const copiedKey = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
async function copy(text: string, key: string) {
	try {
		await navigator.clipboard.writeText(text);
		copiedKey.value = key;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			copiedKey.value = null;
		}, 1500);
	} catch {
		// Clipboard denied (insecure context / permissions) — no-op.
	}
}

function openShare() {
	mode.value = "share";
	drawerOpen.value = true;
}

// --- Editing -------------------------------------------------------------
// The editable EXIF fields, in drawer order. Dates/GPS are display-only for
// now (they need dedicated pickers). Values live in a draft copy so Cancel is
// a no-op and Save emits only what changed.
interface EditField {
	key: keyof Photo;
	label: string;
	numeric?: boolean;
}

const editFields: EditField[] = [
	{ key: "camera_make", label: "Camera make" },
	{ key: "camera_model", label: "Camera model" },
	{ key: "lens_info", label: "Lens" },
	{ key: "focal_length", label: "Focal length" },
	{ key: "iso", label: "ISO", numeric: true },
	{ key: "exposure", label: "Shutter" },
	{ key: "aperture", label: "Aperture" },
];

const draft = reactive<Record<string, string>>({});

function startEdit() {
	const p = photo.value;
	if (!p) return;
	for (const f of editFields) {
		const v = p[f.key];
		draft[f.key] = v == null ? "" : String(v);
	}
	mode.value = "edit";
	drawerOpen.value = true;
}

function cancelEdit() {
	mode.value = "view";
}

function saveEdit() {
	const p = photo.value;
	if (!p) return;
	const patch: Partial<Photo> = {};
	for (const f of editFields) {
		const raw = draft[f.key]?.trim() ?? "";
		if (f.numeric) {
			const next = raw === "" ? null : Number(raw);
			if (next !== p[f.key]) (patch as Record<string, unknown>)[f.key] = next;
		} else {
			const next = raw === "" ? null : raw;
			if (next !== p[f.key]) (patch as Record<string, unknown>)[f.key] = next;
		}
	}
	if (Object.keys(patch).length > 0) emit("save", p.id, patch);
	mode.value = "view";
}

// --- Delete --------------------------------------------------------------
const confirmDeleteOpen = ref(false);

function requestDelete() {
	confirmDeleteOpen.value = true;
}

function confirmDelete() {
	const p = photo.value;
	if (!p) return;
	confirmDeleteOpen.value = false;
	// In Trash the destructive action is a permanent purge; elsewhere it's a
	// recoverable move-to-Trash.
	if (props.trash) emit("purge", p.id);
	else emit("delete", p.id);
}

// --- Share / publish -----------------------------------------------------
// The share screen (mode === 'share') toggles public visibility and surfaces the
// tokened URLs. The switches emit up to the parent, which persists via the
// composable and mutates this row in place (visibility/public_token) — so the
// computeds above (sizeRows/snippets) and below react.
// Local draft of the "show location" preference. Seeded from the row and kept as
// the value we send on (re)publish.
const shareShowLocation = ref(false);

const isPublic = computed(() => photo.value?.visibility === "public");
const hasGps = computed(
	() => photo.value?.gps_latitude != null && photo.value?.gps_longitude != null,
);

function togglePublic() {
	const p = photo.value;
	if (!p) return;
	if (p.visibility === "public") emit("unpublish", p.id);
	else emit("publish", p.id, shareShowLocation.value);
}

// Toggling location while public re-publishes to apply it (which rotates the
// link — the "this breaks the old URL" copy is a P7b concern). While private it
// just records the preference for the next publish.
function toggleShowLocation() {
	const p = photo.value;
	if (!p) return;
	shareShowLocation.value = !shareShowLocation.value;
	if (p.visibility === "public") emit("publish", p.id, shareShowLocation.value);
}

// --- Tags ----------------------------------------------------------------
// Resolve the photo's tag_ids against the full tag list into {id, name} chips.
const nameById = computed(
	() => new Map(props.allTags.map((t) => [t.id, t.name])),
);
const photoTags = computed(() => {
	const p = photo.value;
	if (!p?.tag_ids) return [];
	return p.tag_ids
		.split(",")
		.map((id) => ({ id, name: nameById.value.get(id) ?? id }))
		.sort((a, b) => a.name.localeCompare(b.name));
});

// Autocomplete options: every existing tag not already on this photo.
const tagDraft = ref("");
const tagSuggestions = computed(() => {
	const attached = new Set(photoTags.value.map((t) => t.id));
	return props.allTags.filter((t) => !attached.has(t.id)).map((t) => t.name);
});

function addTag() {
	const p = photo.value;
	const name = tagDraft.value.trim();
	if (!p || !name) return;
	// Ignore a no-op re-add of a tag already on the photo.
	if (!photoTags.value.some((t) => t.name.toLowerCase() === name.toLowerCase()))
		emit("attach-tag", p.id, name);
	tagDraft.value = "";
}

function removeTag(tagId: string) {
	const p = photo.value;
	if (p) emit("detach-tag", p.id, tagId);
}

// Re-entering a photo while editing would show a stale draft, so drop back to
// view mode whenever the visible photo changes.
watch(
	() => photo.value?.id,
	() => {
		mode.value = "view";
		confirmDeleteOpen.value = false;
		shareShowLocation.value = photo.value?.show_location === 1;
		tagDraft.value = "";
		copiedKey.value = null;
	},
	{ immediate: true },
);
</script>

<template>
	<Teleport to="body">
		<div
			v-if="photo"
			class="fixed inset-0 z-[100]"
			role="dialog"
			aria-modal="true"
			aria-label="Photo viewer"
		>
			<!-- Frosted backdrop (owned by the image layer; the drawer floats over it) -->
			<button
				class="absolute inset-0 cursor-default bg-[rgba(60,45,80,0.28)] backdrop-blur-sm"
				aria-label="Close photo viewer"
				@click="emit('close')"
			/>

			<!-- Image stage — its right edge retracts to the drawer on md+ so the
			     photo stays centered within the visible area, with equal gutters -->
			<div
				class="absolute inset-y-0 left-0 right-0 flex items-center justify-center p-4 transition-[right] duration-300 ease-out sm:p-8"
				:class="drawerOpen ? 'md:right-[380px]' : ''"
			>
				<img
					:key="photo.id"
					:src="`/api/photos/${photo.id}/variant?size=lg`"
					:alt="photo.original_filename"
					class="pointer-events-none max-h-full max-w-full object-contain drop-shadow-[0_30px_60px_rgba(60,45,90,0.45)]"
				/>

				<button
					v-if="index > 0"
					class="absolute left-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 dark:border-white/12 bg-white/45 dark:bg-white/10 text-white backdrop-blur transition hover:bg-white/70 dark:hover:bg-white/18 sm:left-6"
					aria-label="Previous photo"
					@click="prev"
				>
					<ChevronLeft class="size-5" />
				</button>
				<button
					v-if="index < photos.length - 1"
					class="absolute right-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 dark:border-white/12 bg-white/45 dark:bg-white/10 text-white backdrop-blur transition hover:bg-white/70 dark:hover:bg-white/18 sm:right-6"
					aria-label="Next photo"
					@click="next"
				>
					<ChevronRight class="size-5" />
				</button>

				<!-- Reopen affordance when the drawer is collapsed -->
				<button
					v-if="!drawerOpen"
					class="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full border border-white/70 dark:border-white/12 bg-white/45 dark:bg-white/10 text-white backdrop-blur transition hover:bg-white/70 dark:hover:bg-white/18 sm:right-6 sm:top-6"
					aria-label="Show details"
					@click="drawerOpen = true"
				>
					<PanelRightOpen class="size-5" />
				</button>
			</div>

			<!-- Metadata drawer — glass plane sliding over the image from the right -->
			<Transition
				enter-active-class="transition-transform duration-300 ease-out"
				leave-active-class="transition-transform duration-200 ease-in"
				enter-from-class="translate-x-full"
				leave-to-class="translate-x-full"
			>
				<aside
					v-if="drawerOpen"
					class="absolute inset-y-0 right-0 flex w-[min(380px,100%)] flex-col overflow-hidden border-l border-white/40 dark:border-white/10 bg-white/40 dark:bg-[#1c1830]/92 shadow-[0_0_80px_-10px_rgba(90,70,160,0.5)] backdrop-blur-xl"
				>
					<!-- Header: plate + title + actions (view ⇄ edit) -->
					<header class="flex items-start gap-2 p-7 pb-4">
						<div class="min-w-0 flex-1">
							<h2
								class="break-words font-serif text-[22px] italic leading-tight text-foreground"
							>
								{{ photo.original_filename }}
							</h2>
							<!-- public indicator — placeholder styling (final polish is P7b) -->
							<span
								v-if="photo.visibility === 'public'"
								class="mt-2.5 inline-flex items-center gap-1 rounded-full border border-white/70 dark:border-white/12 bg-white/45 dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur"
							>
								<Globe class="size-3" />
								Public
							</span>
						</div>

						<div class="flex shrink-0 items-center gap-1.5">
							<!-- Back to the detail view from edit / embed screens -->
							<button
								v-if="mode !== 'view'"
								class="flex size-8 items-center justify-center rounded-full border border-white/85 dark:border-white/15 bg-white/55 dark:bg-white/12 text-muted-foreground backdrop-blur transition hover:bg-white/85 dark:hover:bg-white/20 hover:text-foreground"
								aria-label="Back to details"
								@click="mode = 'view'"
							>
								<ArrowLeft class="size-4" />
							</button>

							<!-- Overflow menu: absorbs the per-photo actions so the cluster
							     doesn't grow. New actions go here, not the top row. -->
							<DropdownMenu v-if="mode === 'view'">
								<DropdownMenuTrigger as-child>
									<button
										class="flex size-8 items-center justify-center rounded-full border border-white/85 dark:border-white/15 bg-white/55 dark:bg-white/12 text-muted-foreground backdrop-blur transition hover:bg-white/85 dark:hover:bg-white/20 hover:text-foreground data-[state=open]:bg-white/85 dark:data-[state=open]:bg-white/20 data-[state=open]:text-foreground"
										aria-label="More actions"
									>
										<MoreHorizontal class="size-4" />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									class="z-[120] w-48 border-white/40 dark:border-white/10 bg-white/80 dark:bg-[#1c1830]/85 backdrop-blur-xl"
								>
									<template v-if="trash">
										<DropdownMenuItem @select="emit('restore', photo.id)">
											<RotateCcw class="size-4" />
											Restore
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem variant="destructive" @select="requestDelete">
											<Trash2 class="size-4" />
											Delete forever
										</DropdownMenuItem>
									</template>
									<template v-else>
										<DropdownMenuItem @select="emit('favorite', photo.id)">
											<Heart
												class="size-4"
												:class="
													photo.is_favorite ? 'fill-rose-500 text-rose-500' : ''
												"
											/>
											{{ photo.is_favorite ? "Remove from favorites" : "Add to favorites" }}
										</DropdownMenuItem>
										<DropdownMenuItem @select="openShare">
											<Share2 class="size-4" />
											Share &amp; embed
										</DropdownMenuItem>
										<DropdownMenuItem @select="startEdit">
											<Pencil class="size-4" />
											Edit details
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem variant="destructive" @select="requestDelete">
											<Trash2 class="size-4" />
											Move to Trash
										</DropdownMenuItem>
									</template>
								</DropdownMenuContent>
							</DropdownMenu>

							<button
								class="flex size-8 items-center justify-center rounded-full border border-white/85 dark:border-white/15 bg-white/55 dark:bg-white/12 text-muted-foreground backdrop-blur transition hover:bg-white/85 dark:hover:bg-white/20 hover:text-foreground"
								aria-label="Keyboard shortcuts"
								@click="helpOpen = true"
							>
								<Keyboard class="size-4" />
							</button>
							<button
								class="flex size-8 items-center justify-center rounded-full border border-white/85 dark:border-white/15 bg-white/55 dark:bg-white/12 text-muted-foreground backdrop-blur transition hover:bg-white/85 dark:hover:bg-white/20 hover:text-foreground"
								aria-label="Collapse details"
								@click="drawerOpen = false"
							>
								<PanelRightClose class="size-4" />
							</button>
							<button
								class="flex size-8 items-center justify-center rounded-full border border-white/85 dark:border-white/15 bg-white/55 dark:bg-white/12 text-muted-foreground backdrop-blur transition hover:bg-white/85 dark:hover:bg-white/20 hover:text-foreground"
								aria-label="Close photo viewer"
								@click="emit('close')"
							>
								<X class="size-4" />
							</button>
						</div>
					</header>

					<!-- Body: fact list (view) or editable fields (edit) -->
					<div class="flex-1 overflow-y-auto overflow-x-hidden px-7">
						<template v-if="mode === 'view'">
							<dl class="grid gap-3">
								<div
									v-for="[label, value] in facts"
									:key="label"
									class="border-t border-border pt-2"
								>
									<dt
										class="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
									>
										{{ label }}
									</dt>
									<dd class="font-mono text-[13px] text-foreground">
										{{ value ?? "—" }}
									</dd>
								</div>
							</dl>

							<!-- Tags: chips + free-form add with autocomplete -->
							<section class="mt-4 border-t border-border pt-3">
								<p
									class="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
								>
									Tags
								</p>
								<div v-if="photoTags.length" class="mb-2.5 flex flex-wrap gap-1.5">
									<span
										v-for="tag in photoTags"
										:key="tag.id"
										class="group/tag flex items-center gap-1 rounded-full border border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 py-1 pl-2.5 pr-1 text-[12px] font-medium text-foreground backdrop-blur"
									>
										{{ tag.name }}
										<button
											class="flex size-4 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
											:aria-label="`Remove tag ${tag.name}`"
											@click="removeTag(tag.id)"
										>
											<X class="size-3" />
										</button>
									</span>
								</div>
								<form class="flex items-center gap-1.5" @submit.prevent="addTag">
									<Input
										v-model="tagDraft"
										list="tag-suggestions"
										placeholder="Add a tag"
										aria-label="Add a tag"
										class="h-8 flex-1 border-white/70 dark:border-white/12 bg-white/50 dark:bg-white/10 text-[13px] backdrop-blur"
									/>
									<datalist id="tag-suggestions">
										<option v-for="s in tagSuggestions" :key="s" :value="s" />
									</datalist>
									<button
										type="submit"
										class="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/85 dark:border-white/15 bg-white/55 dark:bg-white/12 text-muted-foreground backdrop-blur transition hover:bg-white/85 dark:hover:bg-white/20 hover:text-foreground disabled:opacity-40"
										:disabled="!tagDraft.trim()"
										aria-label="Add tag"
									>
										<Plus class="size-4" />
									</button>
								</form>
							</section>
						</template>

						<div
							v-else-if="mode === 'edit'"
							class="grid gap-3.5 pb-2"
						>
							<div v-for="f in editFields" :key="f.key" class="grid gap-1">
								<label
									:for="`edit-${f.key}`"
									class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
								>
									{{ f.label }}
								</label>
								<Input
									:id="`edit-${f.key}`"
									v-model="draft[f.key]"
									:type="f.numeric ? 'number' : 'text'"
									class="border-white/70 dark:border-white/12 bg-white/50 dark:bg-white/10 font-mono text-[13px] backdrop-blur"
								/>
							</div>
						</div>

						<!-- Share & embed: publish toggle, then tokened public URLs + snippets -->
						<div v-else class="pb-2">
							<p class="text-[12.5px] leading-relaxed text-muted-foreground">
								Publish this photo to a public link anyone can open — no imgthing
								account needed. Only optimized
								<span class="font-medium text-foreground">WebP</span> renditions
								are shared; the original and its EXIF stay private.
							</p>

							<!-- Public toggle -->
							<div class="mt-5 flex items-center justify-between gap-4">
								<div class="min-w-0">
									<p class="text-sm font-medium text-foreground">Public</p>
									<p class="text-xs text-muted-foreground">
										{{ isPublic ? "Anyone with the link can view this photo." : "Off — this photo is private." }}
									</p>
								</div>
								<button
									type="button"
									role="switch"
									:aria-checked="isPublic"
									aria-label="Public"
									class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-white/70 dark:border-white/12 transition-colors"
									:class="isPublic ? 'bg-primary' : 'bg-white/40 dark:bg-white/10'"
									@click="togglePublic"
								>
									<span
										class="inline-block size-4 rounded-full bg-white shadow-sm transition-transform"
										:class="isPublic ? 'translate-x-6' : 'translate-x-1'"
									/>
								</button>
							</div>

							<!-- Show location toggle — only for geotagged photos -->
							<div v-if="hasGps" class="mt-4 flex items-center justify-between gap-4">
								<div class="min-w-0">
									<p class="text-sm font-medium text-foreground">Show location</p>
									<p class="text-xs text-muted-foreground">
										Include GPS coordinates on the public page.
									</p>
								</div>
								<button
									type="button"
									role="switch"
									:aria-checked="shareShowLocation"
									aria-label="Show location"
									class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-white/70 dark:border-white/12 transition-colors"
									:class="shareShowLocation ? 'bg-primary' : 'bg-white/40 dark:bg-white/10'"
									@click="toggleShowLocation"
								>
									<span
										class="inline-block size-4 rounded-full bg-white shadow-sm transition-transform"
										:class="shareShowLocation ? 'translate-x-6' : 'translate-x-1'"
									/>
								</button>
							</div>

							<!-- Private: nothing to copy yet -->
							<p
								v-if="!isPublic"
								class="mt-5 rounded-lg border border-border bg-white/40 dark:bg-white/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground"
							>
								Turn on Public to generate shareable links and embed snippets.
							</p>

							<template v-else>
							<section class="mt-6">
								<p
									class="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
								>
									Sizes
								</p>
								<div class="grid gap-2.5">
									<div v-for="s in sizeRows" :key="s.key" class="min-w-0">
										<div class="mb-1 flex items-center justify-between gap-2">
											<span class="flex items-baseline gap-2">
												<span class="font-mono text-[12px] font-semibold text-foreground">
													{{ s.name }}
												</span>
												<span class="text-[10.5px] text-muted-foreground">
													{{ s.meta }}
												</span>
											</span>
											<button
												class="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
												:aria-label="`Copy ${s.name} URL`"
												@click="copy(s.url, s.key)"
											>
												<Check v-if="copiedKey === s.key" class="size-3 text-primary" />
												<Copy v-else class="size-3" />
												{{ copiedKey === s.key ? "Copied" : "Copy" }}
											</button>
										</div>
										<pre
											class="overflow-x-auto rounded-lg border border-white/60 dark:border-white/10 bg-white/45 dark:bg-black/25 p-2.5 font-mono text-[11px] leading-relaxed text-foreground backdrop-blur"
										><code>{{ s.url }}</code></pre>
									</div>
								</div>
							</section>

							<section class="mt-5">
								<p
									class="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
								>
									Embed
								</p>
								<div class="grid gap-2.5">
									<div v-for="snip in snippets" :key="snip.key" class="min-w-0">
										<div class="mb-1 flex items-center justify-between">
											<span
												class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
											>
												{{ snip.label }}
											</span>
											<button
												class="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
												:aria-label="`Copy ${snip.label} snippet`"
												@click="copy(snip.code, snip.key)"
											>
												<Check v-if="copiedKey === snip.key" class="size-3 text-primary" />
												<Copy v-else class="size-3" />
												{{ copiedKey === snip.key ? "Copied" : "Copy" }}
											</button>
										</div>
										<pre
											class="overflow-x-auto rounded-lg border border-white/60 dark:border-white/10 bg-white/45 dark:bg-black/25 p-2.5 font-mono text-[11px] leading-relaxed text-foreground backdrop-blur"
										><code>{{ snip.code }}</code></pre>
									</div>
								</div>
							</section>

							<p
								class="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-300"
							>
								Turning this off — or changing Show location — replaces the link,
								so any previously shared URL stops working.
							</p>
							</template>
						</div>
					</div>

					<!-- Footer: view actions or edit Save/Cancel -->
					<footer class="flex gap-2.5 border-t border-border p-7 pt-5">
						<template v-if="mode === 'view'">
							<a
								:href="`/api/photos/${photo.id}/raw`"
								:download="photo.original_filename"
								class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-primary to-[#5a41b8] px-3 py-2.5 text-xs font-semibold text-white transition hover:brightness-105"
							>
								<Download class="size-3.5" />
								Download
							</a>
						</template>
						<template v-else-if="mode === 'share'">
							<button
								class="flex-1 rounded-xl border border-white/85 dark:border-white/15 bg-white/50 dark:bg-white/10 px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground transition hover:bg-white/75 dark:hover:bg-white/18 hover:text-foreground"
								@click="mode = 'view'"
							>
								Done
							</button>
						</template>
						<template v-else>
							<button
								class="flex-1 rounded-xl border border-white/85 dark:border-white/15 bg-white/50 dark:bg-white/10 px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground transition hover:bg-white/75 dark:hover:bg-white/18 hover:text-foreground"
								@click="cancelEdit"
							>
								Cancel
							</button>
							<button
								class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-primary to-[#5a41b8] px-3 py-2.5 text-xs font-semibold text-white transition hover:brightness-105"
								@click="saveEdit"
							>
								<Check class="size-3.5" />
								Save
							</button>
						</template>
					</footer>
				</aside>
			</Transition>

			<!-- Delete confirm — floats above the viewer (z-[110] > viewer z-[100]) -->
			<Dialog v-model:open="confirmDeleteOpen">
				<DialogContent class="z-[110]">
					<DialogHeader>
						<DialogTitle>
							{{ trash ? "Delete this photo forever?" : "Move this photo to Trash?" }}
						</DialogTitle>
						<DialogDescription>
							<template v-if="trash">
								“{{ photo.original_filename }}” and its metadata will be
								permanently removed. This can’t be undone.
							</template>
							<template v-else>
								“{{ photo.original_filename }}” moves to Trash. You can restore it
								later, or empty the Trash to remove it for good.
							</template>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" @click="confirmDeleteOpen = false">
							Cancel
						</Button>
						<Button variant="destructive" @click="confirmDelete">
							{{ trash ? "Delete forever" : "Move to Trash" }}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<!-- Keyboard-shortcut help — floats above the viewer (z-[110] > z-[100]) -->
			<Dialog v-model:open="helpOpen">
				<DialogContent class="z-[110] sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Keyboard shortcuts</DialogTitle>
						<DialogDescription>
							Navigate and act on photos without leaving the keyboard.
						</DialogDescription>
					</DialogHeader>
					<dl class="grid gap-1">
						<div
							v-for="s in shortcuts"
							:key="s.action"
							class="flex items-center justify-between gap-4 border-t border-border py-2 first:border-t-0"
						>
							<dt class="text-sm text-foreground">{{ s.action }}</dt>
							<dd class="flex shrink-0 items-center gap-1">
								<kbd
									v-for="k in s.keys"
									:key="k"
									class="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-1 font-mono text-[12px] font-medium leading-none text-foreground shadow-sm"
								>
									{{ k }}
								</kbd>
							</dd>
						</div>
					</dl>
				</DialogContent>
			</Dialog>
		</div>
	</Teleport>
</template>
