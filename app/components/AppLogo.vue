<script setup lang="ts">
import { computed, useId } from "vue";

// The imgthing brand: a split-image focusing-screen mark — bracket wings framing
// a focusing circle, a central spot cut by an aurora "split bar". The spot rests
// slightly out of focus (halves offset across the bar) and snaps into alignment
// on hover when `interactive`. Ink is `currentColor` so it adapts to the theme;
// the bar is the one aurora accent. See ADR 0007 / the imgthing-ui skill.
const props = withDefaults(
	defineProps<{
		/** Height of the mark in px; the wordmark scales from it. */
		size?: number;
		/** Render the lowercase mono wordmark beside the mark. */
		wordmark?: boolean;
		/** Pull the split into focus on hover. */
		interactive?: boolean;
		/** `full` keeps the wings; `simple` drops them for tight spaces. */
		variant?: "full" | "simple";
	}>(),
	{ size: 28, wordmark: false, interactive: false, variant: "full" },
);

const gid = computed(() => `aur-${useId()}`);
const box = computed(() =>
	props.variant === "full" ? "0 0 260 140" : "0 0 140 140",
);
const aspect = computed(() => (props.variant === "full" ? 260 / 140 : 1));
const markWidth = computed(() => Math.round(props.size * aspect.value));
const wordSize = computed(() => Math.round(props.size * 0.72));
const gradEnd = computed(() => (props.variant === "full" ? 260 : 140));
</script>

<template>
	<span
		class="app-logo"
		:class="{ interactive }"
		role="img"
		aria-label="imgthing"
	>
		<svg
			class="mark"
			:viewBox="box"
			:width="markWidth"
			:height="size"
			fill="none"
			aria-hidden="true"
		>
			<defs>
				<linearGradient
					:id="gid"
					x1="0"
					y1="140"
					:x2="gradEnd"
					y2="0"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0" stop-color="#ffcca6" />
					<stop offset="0.34" stop-color="#d3aeff" />
					<stop offset="0.66" stop-color="#9ccdff" />
					<stop offset="1" stop-color="#8fe3c4" />
				</linearGradient>
			</defs>

			<!-- full: bracket wings + circle (top/bottom arcs only) + split spot + aurora bar -->
			<template v-if="variant === 'full'">
				<!-- circle: only its upper and lower arcs are shown -->
				<path
					class="ink"
					stroke="currentColor"
					stroke-width="6"
					stroke-linecap="round"
					d="M97.5 37.5 A46 46 0 0 1 162.5 37.5"
				/>
				<path
					class="ink"
					stroke="currentColor"
					stroke-width="6"
					stroke-linecap="round"
					d="M162.5 102.5 A46 46 0 0 1 97.5 102.5"
				/>
				<!-- wings: horizontal bars + bowed outer edge -->
				<path
					class="ink"
					stroke="currentColor"
					stroke-width="6"
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M64 35 L40 35 A96 96 0 0 0 40 105 L64 105"
				/>
				<path
					class="ink"
					stroke="currentColor"
					stroke-width="6"
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M196 35 L220 35 A96 96 0 0 1 220 105 L196 105"
				/>
				<!-- central split spot -->
				<path
					class="spot foc top"
					stroke="currentColor"
					stroke-width="5"
					stroke-linecap="round"
					d="M112 70 A18 18 0 0 1 148 70"
				/>
				<path
					class="spot foc bot"
					stroke="currentColor"
					stroke-width="5"
					stroke-linecap="round"
					d="M148 70 A18 18 0 0 1 112 70"
				/>
				<line
					:stroke="`url(#${gid})`"
					stroke-width="7"
					stroke-linecap="round"
					x1="100"
					y1="70"
					x2="160"
					y2="70"
				/>
			</template>

			<!-- simple: a single split circle + aurora bar (favicon / tight spaces) -->
			<template v-else>
				<path
					class="spot foc top"
					stroke="currentColor"
					stroke-width="9"
					stroke-linecap="round"
					d="M40 70 A30 30 0 0 1 100 70"
				/>
				<path
					class="spot foc bot"
					stroke="currentColor"
					stroke-width="9"
					stroke-linecap="round"
					d="M100 70 A30 30 0 0 1 40 70"
				/>
				<line
					:stroke="`url(#${gid})`"
					stroke-width="11"
					stroke-linecap="round"
					x1="22"
					y1="70"
					x2="118"
					y2="70"
				/>
			</template>
		</svg>

		<span
			v-if="wordmark"
			class="word"
			:style="{ fontSize: `${wordSize}px` }"
		>
			imgthing
		</span>
	</span>
</template>

<style scoped>
.app-logo {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	color: var(--foreground);
}
.mark {
	display: block;
	overflow: visible;
}
/* rest out of focus: the two halves offset across the split bar */
.top {
	transform: translate(-6px, 0);
}
.bot {
	transform: translate(6px, 0);
}
.foc {
	transition: transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.app-logo.interactive:hover .top,
.app-logo.interactive:hover .bot {
	transform: translate(0, 0);
}
.word {
	font-family: var(--font-mono);
	font-weight: 500;
	letter-spacing: -0.04em;
	line-height: 1;
	color: var(--foreground);
}
@media (prefers-reduced-motion: reduce) {
	.foc {
		transition: none;
	}
}
</style>
