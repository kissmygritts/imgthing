<script setup lang="ts">
import { MoreVertical } from "@lucide/vue";
import type { Component } from "vue";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

// One row shared by the Folders and Tags lists: a left-aligned SidebarMenuButton
// (icon · label · count) with a 3-dot menu revealed on hover. The button reserves
// right padding (pr-8) so the count sits clear of where the menu appears.
//
// The row lives in its own `group/entry` wrapper and the nested `default` slot
// (e.g. an expanded folder's children) sits OUTSIDE that wrapper — so hovering a
// parent folder never leaks the hover state onto its descendants' menus.
//
// When `iconInteractive` is set the icon becomes its own click target: it emits
// `iconClick` (stopping the row's select) instead of the row selecting. The folder
// tree uses this to expand/collapse by clicking the folder icon — no chevron, so
// the icon stays in the normal slot, flush-left with the tag / Library rows.
//
// Slots:
//   menu  — the DropdownMenuItems for this row's actions.
//   (default) — nested rows.
defineProps<{
	icon: Component;
	label: string;
	count?: number;
	active?: boolean;
	// Left indent in px, for nested rows (folder tree depth).
	indent?: number;
	iconInteractive?: boolean;
}>();

defineEmits<{ select: []; iconClick: [] }>();
</script>

<template>
	<SidebarMenuItem>
		<div class="group/entry relative">
			<SidebarMenuButton
				:class="$slots.menu ? 'pr-8' : undefined"
				:tooltip="label"
				:is-active="active"
				:style="indent ? { paddingLeft: `${8 + indent}px` } : undefined"
				@click="$emit('select')"
			>
				<span
					v-if="iconInteractive"
					role="button"
					tabindex="0"
					aria-label="Toggle folder"
					class="-m-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground [&>svg]:size-4"
					@click.stop="$emit('iconClick')"
					@keydown.enter.stop.prevent="$emit('iconClick')"
					@keydown.space.stop.prevent="$emit('iconClick')"
				>
					<component :is="icon" />
				</span>
				<component :is="icon" v-else />

				<span class="truncate">{{ label }}</span>
				<span
					v-if="count !== undefined"
					class="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums"
				>
					{{ count }}
				</span>
			</SidebarMenuButton>

			<!-- Only rows that supply a #menu slot get the 3-dot actions button.
			     Menuless rows (e.g. Camera / Lens facets) render nothing here so
			     they don't show a dead popover on hover. -->
			<DropdownMenu v-if="$slots.menu">
				<DropdownMenuTrigger as-child>
					<button
						type="button"
						class="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:opacity-100 group-hover/entry:opacity-100 data-[state=open]:opacity-100"
						:aria-label="`${label} actions`"
						@click.stop
					>
						<MoreVertical class="size-3.5" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<slot name="menu" />
				</DropdownMenuContent>
			</DropdownMenu>
		</div>

		<slot />
	</SidebarMenuItem>
</template>
