<script setup lang="ts">
import { Folder, FolderDot, FolderOpenDot, Globe } from "@lucide/vue";
import SidebarEntry from "@/components/SidebarEntry.vue";
import {
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu } from "@/components/ui/sidebar";

export interface FolderNode {
	id: string;
	name: string;
	parent_folder_id: string | null;
	photo_count: number;
	// Public-gallery publishing (ADR 0008). visibility flips to 'public' on
	// publish, minting public_token; the gallery lives at /f/{slug}?token=.
	visibility?: string;
	public_token?: string | null;
	published_at?: string | null;
}

export type FolderAction = "rename" | "delete" | "new-sub" | "share";

const props = defineProps<{
	folders: FolderNode[];
	parentId: string | null;
	depth: number;
	selectedId: string | null;
	expanded: Set<string>;
}>();

const emit = defineEmits<{
	select: [id: string];
	action: [payload: { type: FolderAction; folder: FolderNode }];
	toggle: [id: string];
}>();

const children = computed(() =>
	props.folders.filter((f) => f.parent_folder_id === props.parentId),
);

function hasChildren(id: string): boolean {
	return props.folders.some((f) => f.parent_folder_id === id);
}

// Empty folder → plain Folder. A folder with subfolders shows the "dotted" folder
// (filled look = has contents), opening when expanded. Clicking the icon toggles.
function iconFor(folder: FolderNode) {
	if (!hasChildren(folder.id)) return Folder;
	return props.expanded.has(folder.id) ? FolderOpenDot : FolderDot;
}
</script>

<template>
	<SidebarMenu>
		<SidebarEntry
			v-for="folder in children"
			:key="folder.id"
			:icon="iconFor(folder)"
			:label="folder.name"
			:count="folder.photo_count"
			:active="selectedId === folder.id"
			:indent="depth * 12"
			:icon-interactive="hasChildren(folder.id)"
			@select="emit('select', folder.id)"
			@icon-click="emit('toggle', folder.id)"
		>
			<!-- Published folders carry a globe glyph so the shared state reads at a
			     glance in the tree. -->
			<template v-if="folder.visibility === 'public'" #badge>
				<Globe class="size-3 shrink-0 text-primary" aria-label="Published" />
			</template>

			<template #menu>
				<DropdownMenuItem @click="emit('action', { type: 'new-sub', folder })">
					New subfolder
				</DropdownMenuItem>
				<DropdownMenuItem @click="emit('action', { type: 'rename', folder })">
					Rename
				</DropdownMenuItem>
				<DropdownMenuItem @click="emit('action', { type: 'share', folder })">
					Share…
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					class="text-destructive"
					@click="emit('action', { type: 'delete', folder })"
				>
					Delete
				</DropdownMenuItem>
			</template>

			<FolderTree
				v-if="expanded.has(folder.id) && hasChildren(folder.id)"
				:folders="folders"
				:parent-id="folder.id"
				:depth="depth + 1"
				:selected-id="selectedId"
				:expanded="expanded"
				@select="emit('select', $event)"
				@action="emit('action', $event)"
				@toggle="emit('toggle', $event)"
			/>
		</SidebarEntry>
	</SidebarMenu>
</template>
