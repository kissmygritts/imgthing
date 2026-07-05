# ADR 0001 — Cloudflare-native, single-tenant stack

**Status:** Accepted · 2026-07

## Context

imgthing is a personal photo library for one owner. An earlier scoping doc proposed
Elixir/Phoenix + Postgres (CrunchyBridge) + R2, deploy-anywhere and multi-tenant. That carries
cross-user auth/isolation complexity and multiple vendors for a single-user app.

## Decision

Build entirely on Cloudflare, single-tenant:

- **Compute:** Nuxt 4 (SSR) on Cloudflare Workers via nitro `cloudflare_module` preset. Workers
  is Cloudflare's first-class compute; BEAM doesn't run in isolate compute.
- **Database:** Cloudflare D1 (SQLite). Single-user metadata is nowhere near D1's limits. Drops
  the Postgres vendor.
- **Originals:** R2, one object per photo. Free egress.
- **Variants:** Cloudflare Images on-the-fly transforms from R2 originals — no variant pipeline,
  no `photo_variants` table, no redundant storage.
- **Auth:** single owner, one credential set, no `user_id` scoping anywhere. Hand-rolled login
  vs. Cloudflare Access is deferred to ADR TBD.
- **Domain:** `gritts.net` on Cloudflare DNS + a Workers Custom Domain.

## Consequences

- One vendor, near-zero cost (~$5/mo, mostly the Workers Paid base fee for CPU headroom).
- Tied to Cloudflare primitives (D1/R2/Images bindings); portability is reduced by design.
- No multi-user support without significant rework — acceptable, it's explicitly single-owner.
