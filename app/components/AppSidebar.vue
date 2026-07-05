<script setup lang="ts">
import {
	ChevronsUpDown,
	FolderPlus,
	Heart,
	Images,
	Layers,
	Loader2,
	LogOut,
	Search,
	Upload,
} from "@lucide/vue";
import FolderTree from "@/components/FolderTree.vue";
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
} from "@/components/ui/sidebar";

const {
	folders,
	selectedFolderId,
	favoritesOnly,
	selectFolder,
	selectFavorites,
	expanded,
	search,
	toggleExpand,
	uploading,
	upload,
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

const fileInput = ref<HTMLInputElement | null>(null);

function pickFiles() {
	fileInput.value?.click();
}

async function onFilesSelected(event: Event) {
	const input = event.target as HTMLInputElement;
	const files = Array.from(input.files ?? []);
	input.value = "";
	await upload(files);
}
</script>

<template>
	<Sidebar collapsible="offcanvas" class="border-none">
		<SidebarHeader class="gap-3 px-3 pt-4">
			<!-- Brand -->
			<div class="flex items-center gap-2.5 px-1">
				<span class="brand-mark size-7 shrink-0 rounded-full" aria-hidden="true" />
				<span class="font-serif text-xl italic tracking-tight text-foreground">
					imgthing
				</span>
			</div>

			<!-- Search (root-plane field) -->
			<div
				class="flex items-center gap-2 rounded-xl border border-white/60 bg-white/35 px-3 py-2 transition-colors focus-within:border-primary/40 focus-within:bg-white/60"
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
			<input
				ref="fileInput"
				type="file"
				accept="image/*"
				multiple
				class="hidden"
				@change="onFilesSelected"
			/>
			<button
				type="button"
				:disabled="uploading"
				class="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-primary to-[#5a41b8] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/40 transition-transform hover:-translate-y-px active:translate-y-0 disabled:opacity-70"
				@click="pickFiles"
			>
				<Loader2 v-if="uploading" class="size-4 animate-spin" />
				<Upload v-else class="size-4" />
				{{ uploading ? "Uploading…" : "Upload photos" }}
			</button>
		</SidebarHeader>

		<SidebarContent class="px-1">
			<SidebarGroup>
				<SidebarGroupLabel>Library</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="All photos"
								:is-active="!favoritesOnly && selectedFolderId === null"
								@click="selectFolder(null)"
							>
								<Images />
								<span>All photos</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="Favorites"
								:is-active="favoritesOnly"
								@click="selectFavorites()"
							>
								<Heart />
								<span>Favorites</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="Uncategorized"
								:is-active="!favoritesOnly && selectedFolderId === 'none'"
								@click="selectFolder('none')"
							>
								<Layers />
								<span>Uncategorized</span>
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
						:selected-id="favoritesOnly ? null : selectedFolderId"
						:expanded="expanded"
						@select="selectFolder($event)"
						@action="onTreeAction"
						@toggle="toggleExpand"
					/>
					<p v-else class="px-2 py-1 text-xs text-muted-foreground">
						No folders yet
					</p>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>

		<SidebarFooter>
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
							<DropdownMenuLabel class="text-xs text-muted-foreground">
								Account
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
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
