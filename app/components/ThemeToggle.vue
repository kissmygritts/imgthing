<script setup lang="ts">
import { Monitor, Moon, Sun } from "@lucide/vue";

// `useColorMode` is auto-imported by @nuxtjs/color-mode. `.preference` is the
// user's choice ('system' | 'light' | 'dark'); `.value` is the resolved mode.
const colorMode = useColorMode();

// The stored preference only resolves on the client, so avoid reflecting the
// active segment until after mount — this keeps SSR and first client render
// identical (no hydration mismatch); the theme itself never flashes because
// color-mode sets the <html> class via its inline head script.
const mounted = ref(false);
onMounted(() => {
	mounted.value = true;
});

const options = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "system", label: "System", icon: Monitor },
	{ value: "dark", label: "Dark", icon: Moon },
] as const;
</script>

<template>
	<div
		class="flex items-center gap-0.5 rounded-full border border-white/60 bg-white/35 p-0.5 dark:border-white/12 dark:bg-white/8"
		role="radiogroup"
		aria-label="Color theme"
	>
		<button
			v-for="opt in options"
			:key="opt.value"
			type="button"
			role="radio"
			:aria-checked="colorMode.preference === opt.value"
			:aria-label="opt.label"
			:title="opt.label"
			class="flex flex-1 items-center justify-center rounded-full py-1.5 text-muted-foreground transition-colors hover:text-foreground"
			:class="
				mounted && colorMode.preference === opt.value
					? 'bg-primary/15 text-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none'
					: ''
			"
			@click="colorMode.preference = opt.value"
		>
			<component :is="opt.icon" class="size-4" />
		</button>
	</div>
</template>
