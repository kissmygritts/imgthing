<script setup lang="ts">
import { ChevronDown, Heart } from "@lucide/vue";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";

// The Filters sheet — every control below binds straight to useLibrary()
// filter state (no local draft, no Apply). Opening/closing this sheet never
// changes what's applied; it's purely a view onto the same composable state
// the toolbar badge and grid already react to.
defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [boolean] }>();

const {
	tags,
	cameras,
	lenses,
	favoritesOnly,
	selectedTagIds,
	selectedCamera,
	selectedLens,
	visibilityFilter,
	filterDateFrom,
	filterDateTo,
	activeFilterCount,
	toggleFavorites,
	toggleTag,
	clearFilters,
} = useLibrary();

const visibilityOptions = [
	{ value: "any", label: "Any" },
	{ value: "public", label: "Public" },
	{ value: "private", label: "Private" },
] as const;

// Native date inputs want a plain string, filter state is string | null —
// bridge with a getter/setter pair so an empty input clears the filter.
const dateFromModel = computed({
	get: () => filterDateFrom.value ?? "",
	set: (v: string | number) => {
		filterDateFrom.value = String(v) || null;
	},
});
const dateToModel = computed({
	get: () => filterDateTo.value ?? "",
	set: (v: string | number) => {
		filterDateTo.value = String(v) || null;
	},
});

const pillTrigger =
	"flex w-full items-center justify-between gap-2 rounded-full border border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:text-foreground";
const sectionLabel =
	"text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
</script>

<template>
	<Sheet :open="open" @update:open="emit('update:open', $event)">
		<SheetContent
			side="right"
			class="w-3/4 gap-0 border-white/60 bg-white/80 backdrop-blur-2xl dark:border-white/12 dark:bg-[#1c1830]/80 sm:max-w-sm"
		>
			<SheetHeader>
				<SheetTitle class="font-serif text-xl font-normal tracking-tight">
					Filters
				</SheetTitle>
				<SheetDescription>
					Combine facets to narrow the gallery — every change updates the
					grid immediately.
				</SheetDescription>
			</SheetHeader>

			<div class="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
				<!-- Favorite -->
				<section class="flex flex-col gap-2">
					<h3 :class="sectionLabel">Favorite</h3>
					<button
						type="button"
						class="flex items-center gap-2 self-start rounded-full border px-4 py-2 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors"
						:class="
							favoritesOnly
								? 'border-primary/40 bg-primary/15 text-accent-foreground'
								: 'border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 text-muted-foreground hover:text-foreground'
						"
						@click="toggleFavorites"
					>
						<Heart
							class="size-3.5"
							:class="favoritesOnly && 'fill-current text-rose-500'"
						/>
						Favorites only
					</button>
				</section>

				<!-- Tags (multi-select) -->
				<section v-if="tags.length" class="flex flex-col gap-2">
					<h3 :class="sectionLabel">Tags</h3>
					<DropdownMenu>
						<DropdownMenuTrigger as-child>
							<button :class="pillTrigger">
								{{
									selectedTagIds.length
										? `${selectedTagIds.length} tag${selectedTagIds.length === 1 ? "" : "s"}`
										: "Any tag"
								}}
								<ChevronDown class="size-3 opacity-70" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" class="min-w-56">
							<DropdownMenuCheckboxItem
								v-for="tag in tags"
								:key="tag.id"
								:model-value="selectedTagIds.includes(tag.id)"
								@select.prevent="toggleTag(tag.id)"
							>
								#{{ tag.name }}
							</DropdownMenuCheckboxItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</section>

				<!-- Camera -->
				<section v-if="cameras.length" class="flex flex-col gap-2">
					<h3 :class="sectionLabel">Camera</h3>
					<DropdownMenu>
						<DropdownMenuTrigger as-child>
							<button :class="pillTrigger">
								{{ selectedCamera ?? "Any camera" }}
								<ChevronDown class="size-3 opacity-70" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" class="min-w-56">
							<DropdownMenuRadioGroup
								:model-value="selectedCamera ?? ''"
								@update:model-value="
									(v) => (selectedCamera = (v as string) || null)
								"
							>
								<DropdownMenuRadioItem value="">Any camera</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									v-for="camera in cameras"
									:key="camera.name"
									:value="camera.name"
								>
									{{ camera.name }}
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</section>

				<!-- Lens -->
				<section v-if="lenses.length" class="flex flex-col gap-2">
					<h3 :class="sectionLabel">Lens</h3>
					<DropdownMenu>
						<DropdownMenuTrigger as-child>
							<button :class="pillTrigger">
								{{ selectedLens ?? "Any lens" }}
								<ChevronDown class="size-3 opacity-70" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" class="min-w-56">
							<DropdownMenuRadioGroup
								:model-value="selectedLens ?? ''"
								@update:model-value="
									(v) => (selectedLens = (v as string) || null)
								"
							>
								<DropdownMenuRadioItem value="">Any lens</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									v-for="lens in lenses"
									:key="lens.name"
									:value="lens.name"
								>
									{{ lens.name }}
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</section>

				<!-- Visibility -->
				<section class="flex flex-col gap-2">
					<h3 :class="sectionLabel">Visibility</h3>
					<div
						class="flex items-center gap-0.5 rounded-full border border-white/70 bg-white/55 p-0.5 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/12 dark:bg-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
						role="radiogroup"
						aria-label="Visibility"
					>
						<button
							v-for="opt in visibilityOptions"
							:key="opt.value"
							type="button"
							role="radio"
							:aria-checked="visibilityFilter === opt.value"
							class="flex flex-1 items-center justify-center rounded-full border border-transparent py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
							:class="
								visibilityFilter === opt.value
									? 'border-primary/40 bg-primary/15 text-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
									: ''
							"
							@click="visibilityFilter = opt.value"
						>
							{{ opt.label }}
						</button>
					</div>
				</section>

				<!-- Date range -->
				<section class="flex flex-col gap-2">
					<h3 :class="sectionLabel">Date taken</h3>
					<div class="flex items-center gap-2">
						<Input v-model="dateFromModel" type="date" aria-label="From date" />
						<span class="shrink-0 text-xs text-muted-foreground">to</span>
						<Input v-model="dateToModel" type="date" aria-label="To date" />
					</div>
				</section>
			</div>

			<SheetFooter>
				<button
					type="button"
					class="flex items-center justify-center gap-2 rounded-full border border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
					:disabled="!activeFilterCount"
					@click="clearFilters"
				>
					Clear filters{{ activeFilterCount ? ` (${activeFilterCount})` : "" }}
				</button>
			</SheetFooter>
		</SheetContent>
	</Sheet>
</template>
