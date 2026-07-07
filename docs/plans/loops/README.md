# Loop plans

Execution plans for the autonomous `/loop` batches defined in [`../../TODO.md`](../../TODO.md).
One file per batch. Each plan is self-contained: an orchestrator loop that implements its backlog
items **one per subagent** so the driving context stays lean.

| Plan | Items | Human input | Notes |
|---|---|---|---|
| [loop-1-fixes.md](./loop-1-fixes.md) | #1 mobile menu, #2 all EXIF | None | Fixes / mechanical wins |
| [loop-2-settings.md](./loop-2-settings.md) | #7 shell, #3 usage metrics, #4 db viewer | Low | #7 must land first (blocks #3/#4) |
| [loop-3-gallery.md](./loop-3-gallery.md) | #5 bulk actions | Low | Extends the bulk bar that already ships |
| [loop-4-docs.md](./loop-4-docs.md) | #8 API docs | Low–Med | One format decision up front |

## The loop protocol (applies to every plan here)

Each plan is a checklist of **items**. One `/loop` iteration = advance one item to done. The driver
must **not** implement inline — it dispatches a single subagent per item to preserve its own context.

Per iteration:

1. **Pick** the first item in this plan whose checkbox is unchecked and whose dependencies (if any)
   are checked.
2. **Dispatch one subagent** (`general-purpose`) with: the item's section from this plan verbatim,
   the repo path, and the standing instruction — *"implement exactly this item; run the gate; do not
   touch other items; return a summary + the gate output."*
3. The subagent implements, then runs the gate — the repo's definition of done (from `CLAUDE.md`):
   ```bash
   npm run check       # Biome, must end clean
   npm run typecheck   # zero errors
   npm run test:all    # unit + integration (builds first — slow)
   ```
   While iterating it may use `npm run test:unit`; `test:all` must pass before it returns.
4. **On green:** the driver commits directly to `main` (repo convention), one commit per item, message
   `feat:`/`fix:` scoped to the item. Check the box in this plan file.
5. **On red or blocked:** do **not** commit. Record what failed under the item's *Status* line and, if
   it's a genuine ambiguity, stop the loop and surface the open question to the human rather than guess.
6. When every box is checked, the loop reports done and stops.

## Rules every subagent inherits (from `CLAUDE.md`)

- **Single-owner app.** No `users` table, no per-row scoping — never add multi-tenant concepts.
- **Migrations are additive-only and sequential.** Next number after `0008`. Never edit a prior one.
  Run `npm run db:migrate:local` after adding.
- **New/changed API endpoint ⇒ integration test** in `test/integration/` using
  `import { env, SELF } from "cloudflare:test"` + the `login, pngBytes, url` helpers. Assert the
  unauthenticated 401 case too.
- **DELETE passes ids via query string** (`?ids=a,b,c`), never a body — Workers drops DELETE bodies.
- **Biome formats** (tabs + double quotes) — let `npm run check` fix it; don't hand-format.
- **Every new surface is legible + operable at ~375px in both light and dark**, using Bright Studio
  Glass tokens in `app/assets/css/main.css`. Reuse `app/components/ui/` primitives; no new UI kit.
- **Public serving/security invariants** (`publicNotFound`, no EXIF/GPS on public bytes, soft-delete
  tombstones) are out of scope for every item here — don't touch `server/routes/p/**`.
