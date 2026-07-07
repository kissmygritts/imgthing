import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2026-06-30",
	devtools: { enabled: true },

	devServer: { port: 8000 },

	css: ["~/assets/css/main.css", "maplibre-gl/dist/maplibre-gl.css"],

	modules: ["shadcn-nuxt", "nitro-cloudflare-dev", "@nuxtjs/color-mode"],

	shadcn: {
		prefix: "",
		componentDir: "@/components/ui",
	},

	// Toggle `.dark` on <html> to match the `dark (&:is(.dark *))` variant.
	// The module injects an inline head script so the class is set before
	// paint (no flash), defaults to the system preference, and persists the
	// choice in localStorage.
	colorMode: {
		classSuffix: "",
		preference: "system",
		fallback: "light",
		storageKey: "imgthing-color-mode",
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
