# AR0283 - Review 1

- Job: 2026-10-22-review-ar0283-4e2c4a15
- Branch: h/2026-10-22-ar0283-2e1ee31c
- Commit reviewed: 369e39504489dbc88467fd9b7a842aac72cd01d9
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

**Findings:** none that block merge.

**Notes:**
- F1 (open finding) correctly documents a real residual risk (notice lost if `arthur run` crashes during the up-to-60s queued wait with the `asked/` mark already written); properly filed per the findings-template process, not required to fix in this ticket.
- Line-budget raise (orchestration 2231→2269) is already recorded in `spec/features/AR0283.../ticket.md`'s Decisions as of `main`, satisfying the worker's "needs action" ask.

**Checks run:**
- `npm ci`: clean, 22 packages.
- `npm run check` (tsc): clean, no errors.
- `npm test`: 1024/1024 pass, 0 fail (full suite, ~286s).
- `node --test packages/orchestration/test/decisions.test.ts`: 27/27 pass, new test completes in ~50-80ms (no 10s stall).
- Mutation 1: forced `queued` to always block via `withLock` (removing the immediate/queueLock split) → new test hangs/times out (caught, matches worker's claim).
- Mutation 2: made the wake match any open job question regardless of this block's question text → "the job's earlier question, answered, is not taken for this one" assertion fails (caught).
- Mutation 3: dropped the returned promise from the `job-state` close handler (fire-and-forget) → unhandled rejection crashes the test on the corrupted-log scenario (caught).
- Mutation 4: removed the `where !== undefined` guard on the "not in the decision log yet" wake line → `TypeError: Cannot read properties of undefined (reading 'name')`, test fails (caught).
- Verified core boundary: no changes to `packages/core/`; all new imports (`@arthur/core/lock`, `@arthur/core/plugin`) are published exports; no plugin-to-plugin imports.
- Verified file line budgets: `decision-log.ts` 200, `decision-lock.ts` 24, `decision-hooks.ts` 59, `blocked-notice.ts` 55 — all ≤200, matching the +38 orchestration budget.
- Verified `ask`/`close` CLI call sites (`decision-commands.ts`, `decision-class.ts`) pass no `lock` arg, so commands keep blocking `withLock` as the ticket requires; only the plugin's own `decision-hooks.ts` handlers pass the non-blocking `lock` via `queued`.
- No `package.json` changes (no new runtime/dev deps).

PASS
