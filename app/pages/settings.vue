<script setup lang="ts">
import { Database, HardDrive } from "@lucide/vue";

// Settings shell: a titled page with a pill sub-nav that routes between the
// owner-config sub-pages. Nested file-routes (`pages/settings/*.vue`) render into
// the <NuxtPage /> below, so each sub-page owns its own file and deep-links work.
// Single-owner app — nothing here is user-scoped.

const route = useRoute();

interface SettingsTab {
	label: string;
	to: string;
	icon: typeof HardDrive;
}
const tabs: SettingsTab[] = [
	{ label: "Usage", to: "/settings/usage", icon: HardDrive },
	{ label: "Database", to: "/settings/database", icon: Database },
];
</script>

<template>
	<div class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
		<header class="border-b border-border pb-5">
			<h1 class="font-serif text-3xl font-normal tracking-tight text-foreground">
				Settings
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Owner configuration for your photo library.
			</p>
		</header>

		<!-- Sub-nav: pill tabs. Wraps at phone width; active tab reads as filled. -->
		<nav class="flex flex-wrap gap-2" aria-label="Settings sections">
			<NuxtLink
				v-for="tab in tabs"
				:key="tab.to"
				:to="tab.to"
				class="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
				:class="
					route.path === tab.to
						? 'border-transparent bg-primary text-primary-foreground shadow-sm shadow-primary/30'
						: 'border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/70 dark:hover:bg-white/18 hover:text-foreground'
				"
			>
				<component :is="tab.icon" class="size-4" />
				{{ tab.label }}
			</NuxtLink>
		</nav>

		<NuxtPage />
	</div>
</template>
