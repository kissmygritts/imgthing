<script setup lang="ts">
import { Aperture, Camera, Globe, Heart, ImageOff, Trash2 } from "@lucide/vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Living style reference for imgthing's "Bright Studio Glass" language. Renders
// every token, glass surface, and primitive once, standalone — it reads NO
// library data on purpose, so it works before any photo exists and each section
// can be verified with just `npm run dev`. Sections mirror the imgthing-ui
// skill 1:1. Unlinked dev/reference page; reach it directly at /styleguide.
useHead({ title: "Styleguide · imgthing" });

// Semantic color tokens (app/assets/css/main.css). `swatch` is the class that
// paints the chip; `text` is what reads legibly on top of it.
const tokens = [
	{ name: "background", swatch: "bg-background", text: "text-foreground" },
	{ name: "foreground", swatch: "bg-foreground", text: "text-background" },
	{ name: "card", swatch: "bg-card", text: "text-card-foreground" },
	{ name: "primary", swatch: "bg-primary", text: "text-primary-foreground" },
	{
		name: "secondary",
		swatch: "bg-secondary",
		text: "text-secondary-foreground",
	},
	{ name: "muted", swatch: "bg-muted", text: "text-muted-foreground" },
	{ name: "accent", swatch: "bg-accent", text: "text-accent-foreground" },
	{ name: "destructive", swatch: "bg-destructive", text: "text-white" },
	{ name: "border", swatch: "bg-border", text: "text-foreground" },
];

const charts = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
	"bg-chart-5",
];

// A photorealistic stand-in so the tile demo needs no real image — an aurora-ish
// gradient in place of an <img>.
const demoPhoto =
	"linear-gradient(135deg, #c7adff 0%, #bfe3ff 45%, #bef0dd 75%, #ffd9cf 100%)";

// Mono EXIF fact list, as the lightbox renders it.
const exif = [
	{ k: "Camera", v: "Fujifilm X-T5" },
	{ k: "Lens", v: "XF 33mm F1.4" },
	{ k: "Exposure", v: "1/500s · f/2.0 · ISO 200" },
	{ k: "Focal length", v: "33 mm" },
	{ k: "Taken", v: "2026-06-14 17:42" },
];

const antiPatterns = [
	"A second .glass-panel, or an opaque sidebar — breaks the two-plane illusion.",
	"Unifying the glass densities (/55 chrome · /40 on-photo · panel) — each is tuned per job.",
	"A flat white card standing in for glass — pull the opacity down so backdrop-blur has work to do.",
	"A loud aurora or a second accent hue — the aurora is ambient; --primary is the only brand color.",
	"Serif on buttons/body, or lowercasing prose — serif italic is for the wordmark, titles, filenames.",
	"Raw palette classes (bg-indigo-500) — promote a token in main.css first.",
	"Dark mode as an afterthought — ship both modes together.",
	"Multi-tenant thinking (users table, per-row scope) — single owner, everywhere.",
];

// Shared class strings, lifted so the section header and demos stay in sync.
const eyebrow =
	"font-mono text-xs uppercase tracking-widest text-muted-foreground";
const rootChip =
	"rounded-full border border-white/70 dark:border-white/12 bg-white/55 dark:bg-white/12 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:text-foreground";
const overlayChip =
	"rounded-full border border-white/70 dark:border-white/12 bg-white/40 dark:bg-white/8 text-white backdrop-blur transition hover:bg-white/60 dark:hover:bg-white/15";
</script>

<template>
	<div class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16">
		<!-- Letterhead -->
		<header class="border-b border-border pb-6">
			<p :class="eyebrow">Reference · 00</p>
			<h1
				class="mt-2 font-serif text-4xl font-normal italic tracking-tight text-foreground"
			>
				Bright Studio Glass
			</h1>
			<p class="mt-2 max-w-2xl text-sm text-muted-foreground">
				The living reference for imgthing's UI. Every token, glass surface, and
				primitive rendered once. Mirrors the
				<code class="font-mono text-xs">imgthing-ui</code> skill; reads no library
				data. Toggle light/dark in the sidebar to check both.
			</p>
		</header>

		<!-- 01 · Anchors -->
		<section class="flex flex-col gap-5">
			<p :class="eyebrow">01 · The three anchors</p>
			<div class="grid gap-4 sm:grid-cols-3">
				<div
					v-for="anchor in [
						{
							t: 'Two planes, always',
							d: 'Aurora root plane (z0); a translucent sidebar sits on it; content floats above in one rounded glass panel.',
						},
						{
							t: 'Photos are the subject',
							d: 'Glass, aurora, and accent stay quiet so images carry the color. The aurora is ambient light, not wallpaper.',
						},
						{
							t: 'Single owner, single accent',
							d: 'One iris/violet --primary for selection, actions, focus. No second hue, no multi-tenant concepts.',
						},
					]"
					:key="anchor.t"
					class="rounded-2xl border border-white/70 bg-white/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/12 dark:bg-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
				>
					<p class="font-serif text-lg italic text-foreground">{{ anchor.t }}</p>
					<p class="mt-1.5 text-sm text-muted-foreground">{{ anchor.d }}</p>
				</div>
			</div>
		</section>

		<!-- 02 · Tokens -->
		<section class="flex flex-col gap-5">
			<p :class="eyebrow">02 · Color tokens</p>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
				<div
					v-for="token in tokens"
					:key="token.name"
					class="overflow-hidden rounded-xl border border-border"
				>
					<div
						class="flex h-16 items-end p-2"
						:class="[token.swatch, token.text]"
					>
						<span class="text-xs font-medium">{{ token.name }}</span>
					</div>
					<div class="bg-card px-2 py-1.5">
						<code class="font-mono text-[11px] text-muted-foreground">
							--{{ token.name }}
						</code>
					</div>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<span :class="eyebrow">Chart</span>
				<span
					v-for="c in charts"
					:key="c"
					class="size-7 rounded-full border border-border"
					:class="c"
				/>
			</div>
		</section>

		<!-- 03 · Typography -->
		<section class="flex flex-col gap-5">
			<p :class="eyebrow">03 · Typography (tri-voice)</p>
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="rounded-xl border border-border bg-card p-5">
					<p class="font-serif text-3xl font-normal italic tracking-tight">
						Serif
					</p>
					<p class="mt-2 text-xs text-muted-foreground">
						Wordmark, view titles, lightbox filename. Italic, editorial —
						carries voice, not data.
					</p>
				</div>
				<div class="rounded-xl border border-border bg-card p-5">
					<p class="font-mono text-2xl">Mono 1/500s</p>
					<p class="mt-2 text-xs text-muted-foreground">
						EXIF facts, the PLATE 004 / N number, byte counts. Labels go
						uppercase tracking-widest. The instrument voice.
					</p>
				</div>
				<div class="rounded-xl border border-border bg-card p-5">
					<p class="text-2xl font-semibold">Sans</p>
					<p class="mt-2 text-xs text-muted-foreground">
						Buttons, nav, body, captions. -apple-system first. Everything the
						other two voices don't claim.
					</p>
				</div>
			</div>
			<!-- Wordmark + brand mark, as the sidebar renders them -->
			<div
				class="flex items-center gap-2.5 rounded-xl border border-border bg-card px-5 py-4"
			>
				<span class="brand-mark size-7 shrink-0 rounded-full" aria-hidden="true" />
				<span class="font-serif text-xl italic tracking-tight text-foreground">
					imgthing
				</span>
				<span class="ml-2 font-mono text-xs text-muted-foreground">
					← wordmark + .brand-mark aperture ring
				</span>
			</div>
		</section>

		<!-- 04 · Glass surfaces -->
		<section class="flex flex-col gap-5">
			<p :class="eyebrow">04 · Glass surfaces — three densities</p>
			<div class="grid gap-4 sm:grid-cols-2">
				<!-- Root-plane chip -->
				<div class="rounded-2xl border border-border bg-card p-5">
					<p class="font-serif text-lg italic">Root-plane chip</p>
					<p class="mb-4 text-xs text-muted-foreground">
						bg-white/55 · /12 · inset highlight. Toolbar buttons, filter pills,
						fields.
					</p>
					<div class="flex flex-wrap gap-2">
						<button :class="rootChip" class="px-4 py-2 text-xs font-semibold">
							Default
						</button>
						<button
							class="rounded-full border border-primary/40 bg-primary/15 px-4 py-2 text-xs font-semibold text-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
						>
							Active
						</button>
					</div>
				</div>
				<!-- On-photo overlay chip, shown over a gradient -->
				<div
					class="relative overflow-hidden rounded-2xl border border-border p-5"
					:style="{ background: demoPhoto }"
				>
					<p class="font-serif text-lg italic text-white drop-shadow">
						On-photo overlay chip
					</p>
					<p class="mb-4 text-xs text-white/80 drop-shadow">
						bg-white/40 · /8 · backdrop-blur. Controls that ride on an image.
					</p>
					<div class="flex gap-2">
						<button
							:class="overlayChip"
							class="flex size-9 items-center justify-center"
						>
							<Heart class="size-4" />
						</button>
						<button
							:class="overlayChip"
							class="flex size-9 items-center justify-center"
						>
							<Globe class="size-4" />
						</button>
						<button
							:class="overlayChip"
							class="flex size-9 items-center justify-center"
						>
							<Trash2 class="size-4" />
						</button>
					</div>
				</div>
			</div>
			<p class="text-xs text-muted-foreground">
				The third density — <code class="font-mono">.glass-panel</code>, the
				floating panel this whole page rides in — is supplied by the layout. Its
				always-on prism rim is the frosted edge around the content area.
			</p>
		</section>

		<!-- 05 · Container vocabulary -->
		<section class="flex flex-col gap-5">
			<p :class="eyebrow">05 · Container vocabulary — four roles</p>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Photo tile (with prism edge on hover) -->
				<figure
					class="group relative aspect-square overflow-hidden rounded-[20px] shadow-[0_1px_2px_rgba(51,43,73,0.06),0_14px_30px_-16px_rgba(51,43,73,0.35)] transition-transform duration-300 hover:-translate-y-1"
				>
					<div class="absolute inset-0" :style="{ background: demoPhoto }" />
					<span class="prism-edge" />
					<span
						class="pointer-events-none absolute inset-0 rounded-[20px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
					/>
					<figcaption
						class="absolute inset-x-3 bottom-2.5 font-mono text-[11px] text-white/90 drop-shadow"
					>
						Photo tile · hover me
					</figcaption>
				</figure>

				<!-- shadcn Card -->
				<Card class="justify-center">
					<CardHeader class="gap-1">
						<CardDescription>Card</CardDescription>
						<CardTitle class="text-2xl tabular-nums">1,240</CardTitle>
					</CardHeader>
				</Card>

				<!-- Glass chip / pill -->
				<div
					class="flex items-center justify-center rounded-2xl border border-border bg-card p-4"
				>
					<button :class="rootChip" class="px-4 py-2 text-xs font-semibold">
						Glass pill
					</button>
				</div>

				<!-- Dashed empty-state (mini) -->
				<div
					class="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-8 text-center"
				>
					<ImageOff class="size-6 text-muted-foreground" />
					<p class="text-xs font-medium">Empty-state</p>
				</div>
			</div>
		</section>

		<!-- 06 · Components -->
		<section class="flex flex-col gap-6">
			<p :class="eyebrow">06 · Components</p>

			<!-- Buttons -->
			<div class="flex flex-col gap-3">
				<p class="font-mono text-xs text-muted-foreground">Button · variants</p>
				<div class="flex flex-wrap items-center gap-2">
					<Button>Default</Button>
					<Button variant="secondary">Secondary</Button>
					<Button variant="outline">Outline</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="destructive">Destructive</Button>
					<Button variant="link">Link</Button>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<Button size="sm">Small</Button>
					<Button size="default">Default</Button>
					<Button size="lg">Large</Button>
					<Button size="icon"><Heart /></Button>
				</div>
			</div>

			<!-- Badges -->
			<div class="flex flex-col gap-3">
				<p class="font-mono text-xs text-muted-foreground">Badge · variants</p>
				<div class="flex flex-wrap items-center gap-2">
					<Badge>Default</Badge>
					<Badge variant="secondary">Secondary</Badge>
					<Badge variant="outline">Outline</Badge>
					<Badge variant="destructive">Destructive</Badge>
				</div>
			</div>

			<!-- Input -->
			<div class="flex flex-col gap-3">
				<p class="font-mono text-xs text-muted-foreground">Input</p>
				<Input class="max-w-sm" placeholder="Search photos" />
			</div>

			<!-- Segmented glass toggle (ThemeToggle idiom) + filter pills -->
			<div class="flex flex-col gap-3">
				<p class="font-mono text-xs text-muted-foreground">
					Segmented glass toggle · filter pills
				</p>
				<div class="flex flex-wrap items-center gap-3">
					<div
						class="flex items-center gap-0.5 rounded-full border border-white/60 bg-white/35 p-0.5 dark:border-white/12 dark:bg-white/8"
					>
						<span
							class="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none"
						>
							Newest
						</span>
						<span class="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
							Oldest
						</span>
						<span class="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
							Name
						</span>
					</div>
					<span
						v-for="chip in [
							{ icon: Camera, label: 'X-T5' },
							{ icon: Aperture, label: '33mm' },
						]"
						:key="chip.label"
						:class="rootChip"
						class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
					>
						<component :is="chip.icon" class="size-3.5 opacity-80" />
						{{ chip.label }}
					</span>
				</div>
			</div>
		</section>

		<!-- 07 · Instrument voice — the plate / EXIF pattern -->
		<section class="flex flex-col gap-5">
			<p :class="eyebrow">07 · Instrument voice — plate & EXIF</p>
			<div
				class="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:grid-cols-[1fr_auto]"
			>
				<div>
					<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
						Plate 004 / 128
					</p>
					<p class="mt-2 font-serif text-2xl italic leading-tight text-foreground">
						golden-hour-ridge.jpg
					</p>
					<dl class="mt-4 flex flex-col gap-1.5">
						<div
							v-for="row in exif"
							:key="row.k"
							class="flex items-baseline justify-between gap-4 border-b border-border/60 pb-1.5 last:border-0"
						>
							<dt class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
								{{ row.k }}
							</dt>
							<dd class="font-mono text-xs tabular-nums text-foreground">
								{{ row.v }}
							</dd>
						</div>
					</dl>
				</div>
				<div
					class="hidden w-40 rounded-xl sm:block"
					:style="{ background: demoPhoto }"
				/>
			</div>
		</section>

		<!-- 08 · Anti-patterns -->
		<section class="flex flex-col gap-5">
			<p :class="eyebrow">08 · Anti-patterns</p>
			<ul class="flex flex-col gap-2">
				<li
					v-for="(ap, i) in antiPatterns"
					:key="i"
					class="flex gap-3 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-foreground"
				>
					<span class="font-mono text-xs text-destructive">✗</span>
					<span>{{ ap }}</span>
				</li>
			</ul>
		</section>

		<footer class="border-t border-border pt-6 pb-2">
			<p class="font-mono text-xs text-muted-foreground">
				$ cat .claude/skills/imgthing-ui/SKILL.md
			</p>
		</footer>
	</div>
</template>
