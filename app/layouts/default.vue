<script setup lang="ts">
import AppSidebar from "@/components/AppSidebar.vue";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
</script>

<template>
	<!-- Aurora root plane: sits behind the whole app. -->
	<div class="aurora" aria-hidden="true">
		<span class="b1" />
		<span class="b2" />
		<span class="b3" />
		<span class="b4" />
	</div>

	<SidebarProvider class="relative z-10 !bg-transparent">
		<AppSidebar />
		<!-- Floating glass panel: rides above the root, inset so aurora peeks around. -->
		<SidebarInset
			class="glass-panel relative m-2 overflow-hidden rounded-[26px] md:m-3"
		>
			<div class="h-full overflow-y-auto px-4 py-5 sm:px-7 sm:py-7">
				<SidebarTrigger class="mb-3 md:hidden" />
				<slot />
			</div>
		</SidebarInset>
	</SidebarProvider>
</template>
