# ADR 0002 — shadcn-nuxt + reka-ui instead of Nuxt UI

**Status:** Accepted · 2026-07

## Context

The v2 plan scaffolded with the Nuxt UI starter template. The owner maintains another project
(`plinth`) built on shadcn-vue and wants imgthing to share that component workflow.

## Decision

Replace Nuxt UI with the plinth stack:

- **shadcn-nuxt + reka-ui + Tailwind v4** (new-york style, `cssVariables`, neutral base color).
- Components live in `app/components/ui/`, added via `npx shadcn-vue@latest add <name>`.
- `cn()` helper in `app/lib/utils.ts`; variants via `class-variance-authority`, exported from
  each component's `index.ts`.
- **Biome** for lint/format (tabs, double quotes) — replaces ESLint.
- Icons: `@lucide/vue` (what the shadcn-vue CLI now installs).

imgthing keeps **SSR on** (unlike plinth's static SPA) because it needs Workers server routes for
auth, uploads, and D1/R2 access.

Design tokens are customized for a photo app — neutral cool-gray chrome + a single blue accent so
photos carry the color — not copied from plinth's terracotta theme.

## Consequences

- Component ownership: we vendor the component source and can edit freely; updates are manual.
- Consistent workflow with plinth (same CLI, same `cn()`/cva patterns).
- Generated shadcn SFCs emit a11y/style lint warnings; Biome `.vue` overrides relax the noisy
  rules (matching plinth), incl. `noVueDuplicateKeys` for the `modelValue` pattern.
