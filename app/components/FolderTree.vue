<script setup lang="ts">
import { ChevronRight, Folder, MoreVertical } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface FolderNode {
	id: string;
	name: string;
	parent_folder_id: string | null;
	photo_count: number;
}

export type FolderAction = "rename" | "delete" | "new-sub";

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
</script>

<template>
	<ul class="space-y-0.5">
		<li v-for="folder in children" :key="folder.id">
			<div
				class="group flex items-center gap-1 rounded-md pr-1 text-sm hover:bg-accent"
				:class="selectedId === folder.id && 'bg-accent font-medium'"
				:style="{ paddingLeft: `${depth * 12}px` }"
			>
				<button
					type="button"
					class="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
					:class="!hasChildren(folder.id) && 'invisible'"
					@click="emit('toggle', folder.id)"
				>
					<ChevronRight
						class="size-3.5 transition-transform"
						:class="expanded.has(folder.id) && 'rotate-90'"
					/>
				</button>
				<button
					type="button"
					class="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
					@click="emit('select', folder.id)"
				>
					<Folder class="size-4 shrink-0 text-muted-foreground" />
					<span class="truncate">{{ folder.name }}</span>
					<span class="ml-auto shrink-0 text-xs text-muted-foreground">
						{{ folder.photo_count }}
					</span>
				</button>
				<DropdownMenu>
					<DropdownMenuTrigger as-child>
						<Button
							variant="ghost"
							size="icon"
							class="size-6 opacity-0 group-hover:opacity-100"
						>
							<MoreVertical class="size-3.5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem @click="emit('action', { type: 'new-sub', folder })">
							New subfolder
						</DropdownMenuItem>
						<DropdownMenuItem @click="emit('action', { type: 'rename', folder })">
							Rename
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							class="text-destructive"
							@click="emit('action', { type: 'delete', folder })"
						>
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
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
		</li>
	</ul>
</template>
