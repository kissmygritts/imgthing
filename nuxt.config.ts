import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2026-06-30",
	devtools: { enabled: true },

	css: ["~/assets/css/main.css"],

	modules: ["shadcn-nuxt", "nitro-cloudflare-dev"],

	shadcn: {
		prefix: "",
		componentDir: "@/components/ui",
	},

	vite: {
		plugins: [tailwindcss()],
		optimizeDeps: {
			include: [
				"reka-ui",
				"clsx",
				"tailwind-merge",
				"class-variance-authority",
			],
		},
	},

	// Deploy to Cloudflare Workers with D1 / R2 / Images bindings.
	nitro: {
		preset: "cloudflare_module",
		cloudflare: {
			deployConfig: true,
			nodeCompat: true,
		},
	},
});
