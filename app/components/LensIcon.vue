<script setup lang="ts">
// Custom Lucide-style glyph: a telephoto lens in profile. Lucide has no lens
// icon, but its `flashlight` is the same silhouette — rotated 90° CW the wide
// reflector becomes the hood and the body becomes the barrel. We drop the
// switch, keep the hood rim (aligned to where the barrel flares), and add a
// focus ring. Matches the `@lucide/vue` SVG contract — 24x24, 2px stroke,
// currentColor — so `class="size-4"` sizes it and it inherits text color.
withDefaults(defineProps<{ size?: number | string }>(), { size: 24 });
</script>

<template>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		:width="size"
		:height="size"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<g transform="rotate(90 12 12)">
			<path
				d="M17 2a1 1 0 0 1 1 1v4a3 3 0 0 1-.6 1.8l-.6.8A4 4 0 0 0 16 12v8a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-8a4 4 0 0 0-.8-2.4l-.6-.8A3 3 0 0 1 6 7V3a1 1 0 0 1 1-1z"
			/>
			<path d="M6 7h12" />
			<path d="M8 17h8" />
		</g>
	</svg>
</template>
