<script setup lang="ts">
import {
	Check,
	ChevronLeft,
	ChevronRight,
	Download,
	PanelRightClose,
	PanelRightOpen,
	Pencil,
	X,
} from "@lucide/vue";
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
}

const props = defineProps<{
	photos: Photo[];
	index: number;
}>();

const emit = defineEmits<{
	close: [];
	"update:index": [value: number];
	// Emitted when the metadata drawer saves an edit. No PATCH endpoint exists
	// yet — the parent is responsible for persisting the patch.
	save: [id: string, patch: Partial<Photo>];
}>();

const photo = computed(() => props.photos[props.index] ?? null);

// Drawer + editing state. The drawer is open by default; collapsing it hands
// the whole stage to the image.
const drawerOpen = ref(true);
const mode = ref<"view" | "edit">("view");

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
		// Esc backs out of edit mode first, then closes the viewer.
		if (mode.value === "edit") cancelEdit();
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
});
onUnmounted(() => {
	window.removeEventListener("keydown", onKeydown);
	document.body.style.overflow = "";
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

const plate = computed(() => String(props.index + 1).padStart(3, "0"));

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

const gpsUrl = computed(() =>
	photo.value?.gps_latitude != null && photo.value?.gps_longitude != null
		? `https://www.openstreetmap.org/?mlat=${photo.value.gps_latitude}&mlon=${photo.value.gps_longitude}#map=15/${photo.value.gps_latitude}/${photo.value.gps_longitude}`
		: null,
);

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

// Re-entering a photo while editing would show a stale draft, so drop back to
// view mode whenever the visible photo changes.
watch(
	() => photo.value?.id,
	() => {
		mode.value = "view";
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
					:src="`/api/photos/${photo.id}/raw`"
					:alt="photo.original_filename"
					class="pointer-events-none max-h-full max-w-full object-contain drop-shadow-[0_30px_60px_rgba(60,45,90,0.45)]"
				/>

				<button
					v-if="index > 0"
					class="absolute left-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/45 text-white backdrop-blur transition hover:bg-white/70 sm:left-6"
					aria-label="Previous photo"
					@click="prev"
				>
					<ChevronLeft class="size-5" />
				</button>
				<button
					v-if="index < photos.length - 1"
					class="absolute right-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/45 text-white backdrop-blur transition hover:bg-white/70 sm:right-6"
					aria-label="Next photo"
					@click="next"
				>
					<ChevronRight class="size-5" />
				</button>

				<!-- Reopen affordance when the drawer is collapsed -->
				<button
					v-if="!drawerOpen"
					class="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full border border-white/70 bg-white/45 text-white backdrop-blur transition hover:bg-white/70 sm:right-6 sm:top-6"
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
					class="absolute inset-y-0 right-0 flex w-[min(380px,100%)] flex-col border-l border-white/40 bg-white/40 shadow-[0_0_80px_-10px_rgba(90,70,160,0.5)] backdrop-blur-xl"
				>
					<!-- Header: plate + title + actions (view ⇄ edit) -->
					<header class="flex items-start gap-2 p-7 pb-4">
						<div class="min-w-0 flex-1">
							<p
								class="mb-3 font-mono text-[10.5px] font-semibold tracking-[0.14em] text-primary"
							>
								PLATE {{ plate }} / {{ photos.length }}
							</p>
							<h2
								class="break-words font-serif text-[22px] italic leading-tight text-foreground"
							>
								{{ photo.original_filename }}
							</h2>
						</div>

						<div class="flex shrink-0 items-center gap-1.5">
							<button
								v-if="mode === 'view'"
								class="flex size-8 items-center justify-center rounded-full border border-white/85 bg-white/55 text-muted-foreground backdrop-blur transition hover:bg-white/85 hover:text-foreground"
								aria-label="Edit details"
								@click="startEdit"
							>
								<Pencil class="size-4" />
							</button>
							<button
								class="flex size-8 items-center justify-center rounded-full border border-white/85 bg-white/55 text-muted-foreground backdrop-blur transition hover:bg-white/85 hover:text-foreground"
								aria-label="Collapse details"
								@click="drawerOpen = false"
							>
								<PanelRightClose class="size-4" />
							</button>
							<button
								class="flex size-8 items-center justify-center rounded-full border border-white/85 bg-white/55 text-muted-foreground backdrop-blur transition hover:bg-white/85 hover:text-foreground"
								aria-label="Close photo viewer"
								@click="emit('close')"
							>
								<X class="size-4" />
							</button>
						</div>
					</header>

					<!-- Body: fact list (view) or editable fields (edit) -->
					<div class="flex-1 overflow-y-auto px-7">
						<dl v-if="mode === 'view'" class="grid gap-3">
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

						<div v-else class="grid gap-3.5 pb-2">
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
									class="border-white/70 bg-white/50 font-mono text-[13px] backdrop-blur"
								/>
							</div>
						</div>
					</div>

					<!-- Footer: view actions or edit Save/Cancel -->
					<footer class="flex gap-2.5 border-t border-border p-7 pt-5">
						<template v-if="mode === 'view'">
							<a
								v-if="gpsUrl"
								:href="gpsUrl"
								target="_blank"
								rel="noopener"
								class="flex-1 rounded-xl border border-white/85 bg-white/50 px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground transition hover:bg-white/75 hover:text-foreground"
							>
								View location
							</a>
							<a
								:href="`/api/photos/${photo.id}/raw`"
								:download="photo.original_filename"
								class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-primary to-[#5a41b8] px-3 py-2.5 text-xs font-semibold text-white transition hover:brightness-105"
							>
								<Download class="size-3.5" />
								Download
							</a>
						</template>
						<template v-else>
							<button
								class="flex-1 rounded-xl border border-white/85 bg-white/50 px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground transition hover:bg-white/75 hover:text-foreground"
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
		</div>
	</Teleport>
</template>
