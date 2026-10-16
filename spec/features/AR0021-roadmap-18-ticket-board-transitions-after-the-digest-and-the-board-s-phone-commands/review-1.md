# AR0021 - Review 1

- Job: 2026-10-16-review-ar0021-board-tran-fe9898e8
- Branch: h/2026-10-16-ar0021-board-transitions-76954a78
- Commit reviewed: f7e6d71f14c72fbf4e8aadbd41a645f73b466278
- Verdict: PASS

## Final message

Notes (non-blocking):
- F1–F3 in the ticket's findings.md are legitimate, correctly scoped as `open`, not required by this ticket's Done means (fakeHost wiring explicitly out of scope per instruction; beforeSpawn gate and branch-findings are separate improvements).
- `ticket-after` event is new workflow-adjacent data but is additive and matches the ticket's accepted Decision (entry 51 will list it).

Checks run (in this worktree):
- `npm ci`: clean (5 packages).
- `npm run check` (tsc): clean, no errors.
- `npm test`: 169/169 pass, 0 fail — matches worker's claim exactly.
- Mutation 1: in `board.ts`, replaced `if (!allowed.includes(to as Status))` guard's condition with `if (false)` (transition table enforcement disabled). Result: `node --test packages/core/test/board.test.ts` → 18 pass, 1 fail — "a move is allowed only as the table says; a merged or dropped ticket never moves again" failed (missing expected exception for `planning -> in-progress`). Reverted via `git checkout -- packages/core/src/board.ts`.
- Mutation 2: in `board-after.ts`, replaced `if (last === id)` self/cycle-detection condition with `if (false)` (cycle/self-wait refusal disabled). Result: 18 pass, 1 fail — "after refuses an unknown id, another project's, a dropped one, itself and a cycle…" failed (missing expected exception for self-wait `DM0001 after DM0001`). Reverted via `git checkout -- packages/core/src/board-after.ts`.
- Confirmed `git status --porcelain` clean after both reverts.
- Spot-verified: status table in `board-file.ts` (`NEXT`) matches the accepted Decision and `ticket.md` doc table exactly; `afterProblem` cycle-chain message format matches ticket's example and test; digest ordering/10-newest-merged/count-line logic in `board-text.ts` matches test fixtures including the exact 4096/4097-byte boundary test in `board-commands.test.ts`; `host.ts`'s `job-started` handler only acts on `kind === "worker"`, extracts ticket id via `FEATURE` regex from each `Ticket:` path, and lets `deliver()`'s existing try/catch turn a refused move into a logged stderr line without killing the job (verified via `spawn.test.ts`'s dedicated test, which also confirms second-start-is-no-op and merged-ticket-refusal-with-job-still-running, status 0, record count 4).
- All new/changed `src/` files (`board.ts` 192, `board-file.ts` 85, `board-text.ts` 24, `board-after.ts` 28, `board-commands.ts` 77, `cli.ts` 179, `host.ts` 154, `ticket-command.ts` 41) under the 200-line cap; core package well under its 4000-line budget per the passing structure test.
- No boundary violation: all changes are within `@arthur/core`'s own `src/`; no plugin touched.
- Scope matches instruction: changes confined to `board.ts` and its own new files, plus `cli.ts`/`host.ts`/`ticket-command.ts` only for wiring, plus docs/tests.

PASS
