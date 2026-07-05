<script setup lang="ts">
import { Loader2, Upload } from "@lucide/vue";
import AppSidebar from "@/components/AppSidebar.vue";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

const { currentTitle, uploading, upload } = useLibrary();

const fileInput = ref<HTMLInputElement | null>(null);

function pickFiles() {
	fileInput.value?.click();
}

async function onFilesSelected(event: Event) {
	const input = event.target as HTMLInputElement;
	const files = Array.from(input.files ?? []);
	input.value = "";
	await upload(files);
}
</script>

<template>
	<SidebarProvider>
		<AppSidebar />
		<SidebarInset>
			<header
				class="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur"
			>
				<SidebarTrigger class="-ml-1" />
				<Separator orientation="vertical" class="mr-1 data-[orientation=vertical]:h-4" />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem class="hidden md:block">
							<span class="text-muted-foreground">Library</span>
						</BreadcrumbItem>
						<BreadcrumbSeparator class="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>{{ currentTitle }}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>

				<div class="ml-auto flex items-center gap-2">
					<input
						ref="fileInput"
						type="file"
						accept="image/*"
						multiple
						class="hidden"
						@change="onFilesSelected"
					/>
					<Button size="sm" :disabled="uploading" @click="pickFiles">
						<Loader2 v-if="uploading" class="size-4 animate-spin" />
						<Upload v-else class="size-4" />
						<span class="hidden sm:inline">
							{{ uploading ? "Uploading…" : "Upload" }}
						</span>
					</Button>
				</div>
			</header>

			<div class="flex flex-1 flex-col gap-4 p-4 sm:p-6">
				<slot />
			</div>
		</SidebarInset>
	</SidebarProvider>
</template>
