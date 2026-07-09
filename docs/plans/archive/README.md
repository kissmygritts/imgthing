# Archived plans — completed autonomous build ledgers

These files were **both spec and state-store** for unattended `/loop` build runs. Every task in each
one is `done` (or a reserved human `hold` that has since landed by hand), so the ledgers are spent —
kept here for history, not as live plans. The remaining backlog lives in [`../../TODO.md`](../../TODO.md);
the durable architecture decisions live in [`../../decisions/`](../../decisions/).

| Plan | Drove | Outcome |
|------|-------|---------|
| [tiers-1-3-autonomous.md](./tiers-1-3-autonomous.md) | T1–T10 | Images variants, delete, search/paging, sort, multi-select, favorites, tags, upload page, map, dark mode |
| [public-photos-plan.md](./public-photos-plan.md) | P1–P9, P7a/P7b | Precomputed WebP variants in R2 + tokened public/private serving (see [ADR 0005](../../decisions/0005-precomputed-variants-from-r2.md)) |
| [next-sprint-autonomous.md](./next-sprint-autonomous.md) | S1–S6 | Soft delete/trash, batch delete, camera/lens filters, upload limits, test audit, mobile pass |
| [features-sprint-autonomous.md](./features-sprint-autonomous.md) | F1–F7 (F2 later reverted, F8 human) | Metadata editing, duplicate detection, keyboard overlay, storage readout |

The loop protocol these share (ledger → claim → delegate to subagent → verify gate → mark done) is
the reusable pattern; copy one as a template for the next unattended sprint.
