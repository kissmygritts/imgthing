<script setup lang="ts">
import {
	ArrowLeft,
	Check,
	ChevronLeft,
	ChevronRight,
	Code2,
	Copy,
	Download,
	Heart,
	MoreHorizontal,
	PanelRightClose,
	PanelRightOpen,
	Pencil,
	Plus,
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
}>();

const emit = defineEmits<{
	close: [];
	"update:index": [value: number];
	// Emitted when the metadata drawer saves an edit. No PATCH endpoint exists
	// yet — the parent is responsible for persisting the patch.
	save: [id: string, patch: Partial<Photo>];
	// Emitted (after confirm) to delete a photo. The parent performs the request,
	// refreshes the list, and advances nav / closes the viewer.
	delete: [id: string];
	// Emitted to toggle the favorite flag. The parent persists + refreshes.
	favorite: [id: string];
	// Emitted to attach a tag (by name — reused or created) to a photo.
	"attach-tag": [id: string, name: string];
	// Emitted to detach a tag (by id) from a photo.
	"detach-tag": [id: string, tagId: string];
}>();

const photo = computed(() => props.photos[props.index] ?? null);

// Drawer + editing state. The drawer is open by default; collapsing it hands
// the whole stage to the image.
const drawerOpen = ref(true);
const mode = ref<"view" | "edit" | "usage">("view");

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

function onKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		// Esc backs out of a sub-screen first, then closes the viewer.
		if (mode.value === "edit") cancelEdit();
		else if (mode.value === "usage") mode.value = "view";
		else emit("close");
		return;
	}
	// Don't hijack arrows while editing a field.
	if (isTypingTarget(e.target)) return;
	if (e.key === "ArrowLeft") prev();
	else if (e.key === "ArrowRight") next();
	else if (e.key === "i") drawerOpen.value = !drawerOpen.value;
}

onMounted(() => {
	window.addEventListener("keydown", onKeydown);
	document.body.style.overflow = "hidden";
	// Absolute origin so the embed screen's URLs are copy-paste ready.
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

// --- Embed / optimize screen --------------------------------------------
// Photos are served as on-the-fly WebP renditions from `/variant?size=…`
// (widths below; height auto, never upscaled) or the untouched `/raw` original.
const origin = ref("");

const embedSizes = [
	{ key: "thumb", width: 800, label: "Thumb" },
	{ key: "md", width: 1280, label: "Medium" },
	{ key: "lg", width: 2560, label: "Large" },
] as const;

function variantUrl(size: string): string {
	const p = photo.value;
	return p ? `${origin.value}/api/photos/${p.id}/variant?size=${size}` : "";
}
const rawUrl = computed(() => {
	const p = photo.value;
	return p ? `${origin.value}/api/photos/${p.id}/raw` : "";
});

// The size list rendered on the embed screen — the three renditions plus the
// untouched original, each as a scrollable, copyable URL box.
const sizeRows = computed(() => [
	...embedSizes.map((s) => ({
		key: s.key,
		name: s.key,
		meta: `${s.width}px wide`,
		url: variantUrl(s.key),
	})),
	{ key: "raw", name: "original", meta: "full resolution", url: rawUrl.value },
]);

// Copy-paste snippets, medium as the sensible default single-size embed.
const snippets = computed(() => {
	const name = photo.value?.original_filename ?? "";
	return [
		{
			key: "html",
			label: "HTML",
			code: `<img src="${variantUrl("md")}" alt="${name}" />`,
		},
		{
			key: "markdown",
			label: "Markdown",
			code: `![${name}](${variantUrl("md")})`,
		},
		{
			key: "srcset",
			label: "Responsive",
			code: `<img
  src="${variantUrl("md")}"
  srcset="${variantUrl("thumb")} 800w,
          ${variantUrl("md")} 1280w,
          ${variantUrl("lg")} 2560w"
  sizes="(max-width: 768px) 100vw, 768px"
  alt="${name}"
/>`,
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

function openUsage() {
	mode.value = "usage";
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
	emit("delete", p.id);
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
		tagDraft.value = "";
		copiedKey.value = null;
	},
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
					class="absolute inset-y-0 right-0 flex w-[min(380px,100%)] flex-col overflow-hidden border-l border-white/40 dark:border-white/8 bg-white/40 dark:bg-white/8 shadow-[0_0_80px_-10px_rgba(90,70,160,0.5)] backdrop-blur-xl"
				>
					<!-- Header: plate + title + actions (view ⇄ edit) -->
					<header class="flex items-start gap-2 p-7 pb-4">
						<div class="min-w-0 flex-1">
							<h2
								class="break-words font-serif text-[22px] italic leading-tight text-foreground"
							>
								{{ photo.original_filename }}
							</h2>
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
									<DropdownMenuItem @select="emit('favorite', photo.id)">
										<Heart
											class="size-4"
											:class="
												photo.is_favorite ? 'fill-rose-500 text-rose-500' : ''
											"
										/>
										{{ photo.is_favorite ? "Remove from favorites" : "Add to favorites" }}
									</DropdownMenuItem>
									<DropdownMenuItem @select="startEdit">
										<Pencil class="size-4" />
										Edit details
									</DropdownMenuItem>
									<DropdownMenuItem @select="openUsage">
										<Code2 class="size-4" />
										Embed &amp; optimize
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem variant="destructive" @select="requestDelete">
										<Trash2 class="size-4" />
										Delete photo
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>

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

						<!-- Embed & optimize: ready-to-use rendition URLs + snippets -->
						<div v-else class="pb-2">
							<p class="text-[12.5px] leading-relaxed text-muted-foreground">
								Every size is generated on the fly as optimized
								<span class="font-medium text-foreground">WebP</span>. Pick a
								width — height scales automatically and never upsamples past
								the original.
							</p>

							<section class="mt-5">
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
								These URLs require an active imgthing session. Public embedding
								on external sites isn't available yet — it needs a public
								delivery domain.
							</p>
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
						<template v-else-if="mode === 'usage'">
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
						<DialogTitle>Delete this photo?</DialogTitle>
						<DialogDescription>
							“{{ photo.original_filename }}” and its metadata will be permanently
							removed. This can’t be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" @click="confirmDeleteOpen = false">
							Cancel
						</Button>
						<Button variant="destructive" @click="confirmDelete">Delete</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	</Teleport>
</template>
