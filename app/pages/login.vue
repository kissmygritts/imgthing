<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

definePageMeta({ layout: false });

const passphrase = ref("");
const error = ref("");
const pending = ref(false);

// If already signed in, don't show the login form.
const { loggedIn } = await useRequestFetch()("/api/auth/session");
if (loggedIn) await navigateTo("/");

async function submit() {
	if (pending.value) return;
	pending.value = true;
	error.value = "";
	try {
		await $fetch("/api/auth/login", {
			method: "POST",
			body: { passphrase: passphrase.value },
		});
		await navigateTo("/");
	} catch {
		error.value = "That passphrase didn't work.";
		passphrase.value = "";
	} finally {
		pending.value = false;
	}
}
</script>

<template>
	<main class="flex min-h-svh items-center justify-center p-6">
		<Card class="w-full max-w-sm">
			<CardHeader>
				<CardTitle class="text-2xl tracking-tight">imgthing</CardTitle>
				<CardDescription>Enter the passphrase to open your library.</CardDescription>
			</CardHeader>
			<CardContent>
				<form class="space-y-4" @submit.prevent="submit">
					<div class="space-y-2">
						<Label for="passphrase">Passphrase</Label>
						<Input
							id="passphrase"
							v-model="passphrase"
							type="password"
							autocomplete="current-password"
							autofocus
							:aria-invalid="!!error"
						/>
						<p v-if="error" class="text-sm text-destructive">{{ error }}</p>
					</div>
					<Button type="submit" class="w-full" :disabled="pending || !passphrase">
						{{ pending ? "Unlocking…" : "Unlock" }}
					</Button>
				</form>
			</CardContent>
		</Card>
	</main>
</template>
