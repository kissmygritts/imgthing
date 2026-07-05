<script setup lang="ts">
import { Button } from "@/components/ui/button";

async function logout() {
	await $fetch("/api/auth/logout", { method: "POST" });
	await navigateTo("/login");
}
</script>

<template>
	<main class="flex min-h-svh flex-col items-center justify-center gap-6 p-8 text-center">
		<div class="space-y-2">
			<h1 class="font-sans text-4xl font-semibold tracking-tight">imgthing</h1>
			<p class="text-muted-foreground">A personal photo library, self-hosted on Cloudflare.</p>
		</div>
		<Button variant="outline" @click="logout">Sign out</Button>
	</main>
</template>
