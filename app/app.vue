<script setup lang="ts">
import { Toaster } from "@/components/ui/sonner";

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
	<Toaster />
</template>
