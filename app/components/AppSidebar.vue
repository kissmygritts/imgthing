<script setup lang="ts">
import {
	Aperture,
	ChevronsUpDown,
	FolderPlus,
	Images,
	Layers,
	LogOut,
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
	SidebarRail,
} from "@/components/ui/sidebar";

const {
	folders,
	selectedFolderId,
	expanded,
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
</script>

<template>
	<Sidebar collapsible="icon">
		<SidebarHeader>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton size="lg" class="cursor-default hover:bg-transparent active:bg-transparent">
						<div
							class="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
						>
							<Aperture class="size-4" />
						</div>
						<div class="grid flex-1 text-left leading-tight">
							<span class="truncate font-semibold">imgthing</span>
							<span class="truncate text-xs text-muted-foreground">Photo library</span>
						</div>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarHeader>

		<SidebarContent>
			<SidebarGroup>
				<SidebarGroupLabel>Library</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="All photos"
								:is-active="selectedFolderId === null"
								@click="selectedFolderId = null"
							>
								<Images />
								<span>All photos</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="Uncategorized"
								:is-active="selectedFolderId === 'none'"
								@click="selectedFolderId = 'none'"
							>
								<Layers />
								<span>Uncategorized</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>

			<SidebarGroup class="group-data-[collapsible=icon]:hidden">
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
						:selected-id="selectedFolderId"
						:expanded="expanded"
						@select="selectedFolderId = $event"
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
									class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground"
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

		<SidebarRail />
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
