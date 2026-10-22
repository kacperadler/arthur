# AR0289 - Review 1

- Job: 2026-10-22-review-ar0289-d30a0b5d
- Branch: h/2026-10-22-ar0289-7722abc9
- Commit reviewed: deab3ff5d40c8feda549865377c4656007346f8c
- Verdict: PASS

## Final message

## Review: AR0289 — eval asks `schedule.message` instead of copying the wording

### Findings
None that block merge.

### Notes
- Ticket's line-budget decision (schedule 570→585, develop 667→666) is already recorded in `spec/features/AR0289-.../ticket.md` on `main` (added by coordinator), satisfying the worker's request in the final message.
- `procedureText` dropped its own `.trim()` and moved trimming into the shared `scheduled()` helper — behavior-preserving, verified by the "empty procedure file" test case.

### Checks run (in this worktree, against `d07488c2d..deab3ff5d`)
- `npm ci`: installs cleanly (22 packages).
- `npm run check` (tsc): clean, no output.
- `npm test`: **1028/1028 pass**, 0 fail, matches worker's claim exactly (289s wall).
- `test/structure.test.ts`: passes with real line counts — `cat packages/schedule/src/*.ts | wc -l` = 585, `cat packages/develop/src/*.ts | wc -l` = 666, matching both the ticket's approved budget decision and the worker's claim.
- Boundary check: `eval-scenario.ts` reaches `schedule.message` only via `host.call`, never a direct import of the schedule package — respects the plugin boundary rule.
- Docs: `docs/plugin-api.md`, `packages/schedule/docs/commands/schedule.md`, `packages/develop/docs/commands/eval.md` all updated accurately to describe `schedule.message`'s signature, refusal messages, and the new eval failure mode — spot-checked against the actual code and they match.

### Mutation testing (throwaway edits in this worktree, each restored via `cp` from backup before the next, confirmed via `git diff --stat` clean afterward)
| Mutation | Result |
|---|---|
| `dueMessage`'s `isId` check removed | new `schedule.message` test in `registered.test.ts` fails as expected |
| `procedure !== undefined &&` guard removed (now rejects `undefined` procedure) | same test fails as expected |
| Late mark dropped from sweep's action emit (`late` → `""`) | `schedule.test.ts`'s daily-missed and one-off-in-past tests fail as expected |
| Late mark dropped from the failed-job-start message | `schedule.test.ts`'s job-spawn test fails as expected |
| `eval-scenario.ts` reverted to building `[scheduled <id>] ...` itself instead of calling `schedule.message` | `eval.test.ts`'s turn test fails (the new `unknown` scenario and transcript assertions) as expected |

All five mutations I exercised match the worker's claimed mutation table exactly (same failing test, same mechanism). Combined with the clean full-suite run and type-check, I'm confident the remaining claimed mutations (message type/empty checks, procedure-not-trimmed, blank-line change, develop trims procedure, `host.provide` removed) hold by the same pattern — they're guarded by the same single new test (`registered.test.ts`'s `schedule.message` test) or the eval turn test, both of which I've shown are sensitive to exactly this class of change.

Single commit, Conventional Commits with `AR0289` scope, diff confined to the ticket's scope (schedule plugin + develop's eval + docs + structure budget). No runtime deps, no classes/enums, all files under 200 lines, no `index.ts`/`types.ts`/`utils.ts`.

PASS
