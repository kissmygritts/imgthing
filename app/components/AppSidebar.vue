<script setup lang="ts">
import {
	CalendarDays,
	Camera,
	ChevronsUpDown,
	FolderPlus,
	Hash,
	Heart,
	Images,
	Layers,
	LogOut,
	MapPin,
	Palette,
	Search,
	Settings,
	Trash2,
	Upload,
} from "@lucide/vue";
import FolderTree from "@/components/FolderTree.vue";
import LensIcon from "@/components/LensIcon.vue";
import SidebarEntry from "@/components/SidebarEntry.vue";
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
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { humanBytes } from "@/lib/utils";

const {
	folders,
	tags,
	cameras,
	lenses,
	stats,
	selectedFolderId,
	favoritesOnly,
	selectedTagId,
	trashOnly,
	selectedCamera,
	selectedLens,
	monthScope,
	selectFolder,
	selectFavorites,
	selectTag,
	selectTrash,
	selectCamera,
	selectLens,
	deleteTag,
	expanded,
	search,
	toggleExpand,
	openCreate,
	onTreeAction,
	dialogOpen,
	dialogMode,
	dialogName,
	dialogBusy,
	submitDialog,
	deleteTarget,
	confirmDelete,
	logout,
} = useLibrary();

// Gallery filters only read as "active" on the gallery route; on /map or
// /upload the nav should highlight that page instead.
const route = useRoute();
const onGallery = computed(() => route.path === "/");

// Storage readout: "1,240 photos · 8.6 GB". Trash reclaim is shown as a hint
// only when there's something tombstoned to reclaim.
const storageLabel = computed(() => {
	const n = stats.value.count;
	return `${n.toLocaleString()} photo${n === 1 ? "" : "s"} · ${humanBytes(stats.value.totalBytes)}`;
});

// On mobile the sidebar is an offcanvas sheet. Picking a filter or following a
// link should dismiss it so the chosen view is actually visible — otherwise the
// sheet stays parked over the gallery. A no-op on desktop.
const { isMobile, setOpenMobile } = useSidebar();
function closeMobile() {
	if (isMobile.value) setOpenMobile(false);
}
</script>

<template>
	<Sidebar collapsible="offcanvas" class="border-none">
		<SidebarHeader class="gap-3 px-3 pt-4">
			<!-- Brand -->
			<div class="px-1">
				<AppLogo :size="24" wordmark interactive />
			</div>

			<!-- Search (root-plane field) -->
			<div
				class="flex items-center gap-2 rounded-xl border border-white/60 dark:border-white/12 bg-white/35 dark:bg-white/8 px-3 py-2 transition-colors focus-within:border-primary/40 focus-within:bg-white/60 dark:focus-within:bg-white/15"
			>
				<Search class="size-4 shrink-0 text-muted-foreground" />
				<input
					v-model="search"
					type="search"
					placeholder="Search photos"
					aria-label="Search photos"
					class="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
				/>
			</div>

			<!-- Upload -->
			<NuxtLink
				to="/upload"
				class="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-primary to-[#5a41b8] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/40 transition-transform hover:-translate-y-px active:translate-y-0"
				@click="closeMobile"
			>
				<Upload class="size-4" />
				Upload photos
			</NuxtLink>
		</SidebarHeader>

		<SidebarContent class="px-1">
			<SidebarGroup>
				<SidebarGroupLabel>Browse</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="All photos"
								:is-active="onGallery && !favoritesOnly && !trashOnly && !selectedCamera && !selectedLens && !selectedTagId && !monthScope && selectedFolderId === null"
								@click="selectFolder(null); closeMobile()"
							>
								<Images />
								<span>All photos</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton as-child tooltip="Map" :is-active="route.path === '/map'">
								<NuxtLink to="/map" @click="closeMobile">
									<MapPin />
									<span>Map</span>
								</NuxtLink>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton as-child tooltip="Calendar" :is-active="route.path === '/calendar'">
								<NuxtLink to="/calendar" @click="closeMobile">
									<CalendarDays />
									<span>Calendar</span>
								</NuxtLink>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>

			<SidebarGroup>
				<SidebarGroupLabel>Library</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="Favorites"
								:is-active="onGallery && favoritesOnly"
								@click="selectFavorites(); closeMobile()"
							>
								<Heart />
								<span>Favorites</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="Uncategorized"
								:is-active="onGallery && !favoritesOnly && selectedFolderId === 'none'"
								@click="selectFolder('none'); closeMobile()"
							>
								<Layers />
								<span>Uncategorized</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="Trash"
								:is-active="onGallery && trashOnly"
								@click="selectTrash(); closeMobile()"
							>
								<Trash2 />
								<span>Trash</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>

			<SidebarGroup>
				<SidebarGroupLabel>Folders</SidebarGroupLabel>
				<SidebarGroupAction title="New folder" @click="openCreate(null)">
					<FolderPlus /> <span class="sr-only">New folder</span>
				</SidebarGroupAction>
				<SidebarGroupContent>
					<FolderTree
						v-if="folders.length"
						:folders="folders"
						:parent-id="null"
						:depth="0"
						:selected-id="!onGallery || favoritesOnly || selectedTagId || selectedCamera || selectedLens ? null : selectedFolderId"
						:expanded="expanded"
						@select="selectFolder($event); closeMobile()"
						@action="onTreeAction"
						@toggle="toggleExpand"
					/>
					<p v-else class="px-2 py-1 text-xs text-muted-foreground">
						No folders yet
					</p>
				</SidebarGroupContent>
			</SidebarGroup>

			<SidebarGroup>
				<SidebarGroupLabel>Tags</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu v-if="tags.length">
						<SidebarEntry
							v-for="tag in tags"
							:key="tag.id"
							:icon="Hash"
							:label="tag.name"
							:count="tag.photo_count"
							:active="onGallery && selectedTagId === tag.id"
							@select="selectTag(tag.id); closeMobile()"
						>
							<template #menu>
								<DropdownMenuItem
									class="text-destructive"
									@click="deleteTag(tag)"
								>
									Delete
								</DropdownMenuItem>
							</template>
						</SidebarEntry>
					</SidebarMenu>
					<p v-else class="px-2 py-1 text-xs text-muted-foreground">
						No tags yet
					</p>
				</SidebarGroupContent>
			</SidebarGroup>

			<SidebarGroup v-if="cameras.length">
				<SidebarGroupLabel>Cameras</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarEntry
							v-for="camera in cameras"
							:key="camera.name"
							:icon="Camera"
							:label="camera.name"
							:count="camera.photo_count"
							:active="onGallery && selectedCamera === camera.name"
							@select="selectCamera(camera.name); closeMobile()"
						/>
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>

			<SidebarGroup v-if="lenses.length">
				<SidebarGroupLabel>Lenses</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarEntry
							v-for="lens in lenses"
							:key="lens.name"
							:icon="LensIcon"
							:label="lens.name"
							:count="lens.photo_count"
							:active="onGallery && selectedLens === lens.name"
							@select="selectLens(lens.name); closeMobile()"
						/>
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>

		<SidebarFooter>
			<div class="px-1 pb-1">
				<ThemeToggle />
			</div>
			<SidebarMenu>
				<SidebarMenuItem>
					<DropdownMenu>
						<DropdownMenuTrigger as-child>
							<SidebarMenuButton
								size="lg"
								class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							>
								<div
									class="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/15 text-primary"
								>
									<span class="text-xs font-medium">ME</span>
								</div>
								<div class="grid flex-1 text-left leading-tight">
									<span class="truncate font-medium">Owner</span>
									<span class="truncate text-xs text-muted-foreground">Signed in</span>
								</div>
								<ChevronsUpDown class="ml-auto size-4" />
							</SidebarMenuButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							class="w-(--reka-dropdown-menu-trigger-width) min-w-56"
							side="top"
							align="start"
							:side-offset="4"
						>
							<!-- Storage-usage readout -->
							<div class="flex flex-col gap-0.5 px-2 py-1.5 text-xs text-muted-foreground">
								<span class="font-medium tabular-nums text-foreground/80">{{ storageLabel }}</span>
								<span v-if="stats.trashedCount > 0" class="tabular-nums">
									{{ humanBytes(stats.trashedBytes) }} in Trash
								</span>
							</div>
							<DropdownMenuSeparator />
							<DropdownMenuItem as-child>
								<NuxtLink to="/styleguide">
									<Palette class="size-4" />
									Style guide
								</NuxtLink>
							</DropdownMenuItem>
							<DropdownMenuItem as-child>
								<NuxtLink to="/settings">
									<Settings class="size-4" />
									Settings
								</NuxtLink>
							</DropdownMenuItem>
							<DropdownMenuItem @click="logout">
								<LogOut class="size-4" />
								Sign out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarFooter>
	</Sidebar>

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
</template>
