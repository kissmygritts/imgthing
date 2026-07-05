<script setup lang="ts">
useHead({
	htmlAttrs: { lang: "en" },
	meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
	link: [{ rel: "icon", href: "/favicon.ico" }],
});

useSeoMeta({
	title: "imgthing",
	description: "A personal photo library.",
});
</script>

<template>
	<NuxtPage />
</template>
