# AR0442 - Review 1

- Job: 2026-10-26-review-1ddc71d4
- Branch: arthur/2026-10-26-worker-d2f7d94d
- Commit reviewed: dc0ae84d657aeb210c5c5cf665ae1a545eefc3db
- Verdict: FAIL

## Final message

I found one blocking problem, so this fails. The fix works and the new tests fail on base, but the branch pushes `packages/delivery` over its line budget, so `npm test` cannot pass.

## Findings

1. **`packages/delivery/src/merge-command.ts:100-103`: the delivery line budget is exceeded.** `test/structure.test.ts` fails "the repository keeps every rule" with `packages/delivery: has 1436 source lines, over its line budget of 1434`. Base was exactly at the budget (`git show` of base `packages/delivery/src` adds up to 1434 lines). This change adds net +2 lines (the `named` line and its comment), so the branch is at 1436. The ticket has no decision raising the budget, and `test/structure.test.ts` is not in the range. That breaks the Shape rule ("a line budget exceeded"), and the full suite cannot pass, which misses the Done means point "`npm test` and `npm run check` pass". Folding the count into the throw, or dropping the new comment, would keep it within 1434.

2. **`packages/delivery/test/merge.test.ts:343-356`: a mutation that moves the limit by one goes uncaught.** Changing `strays.length > 10` to `strays.length > 11` still passes the new test. It only checks 12 commits ("10 named and 2 more") and exactly 10 (all named), never 11, where the right output is "10 named and 1 more". The review criteria count an uncaught limit-moved-by-one mutation as a FAIL.

3. **The worker's final message reports nothing.** It says only "The full `npm test` is still running in the background (bg_1). I'll write the final message once its result arrives." It lists no changes, no check output and no commits. A full `npm test` would have shown the budget failure in finding 1.

## Notes (not blocking)
- The four Done means are otherwise met:
  - `onboarding-ended.md` and `init.md` tell the coordinator to ask for `arthur take-main` before the onboarding's merge. The argument forms match `take-main.ts` (`--decision <id>`, `--project`, a merge-kind decision with no job and no ticket).
  - The refusal names the newest 10 commits, then `and <k> more`.
  - The onboarding test with code on main is refused first, then merges after the take.
- The refusal text now ends with the shared `lift` sentence ("the owner decides, and arthur take-main lifts it"). `docs/commands/merge.md` and all three older test expectations are updated to match.
- `onboarding-ended.md` points the coordinator at `.arthur/delivery/<project>/last-merge`, which is the delivery plugin's own file, named from the projects plugin's prompt. That is only text for an agent, not a plugin reading another plugin's folder.

## Checks run
- `npm ci`: completed without errors.
- `npm run check` (`tsc`): passed with no errors.
- `node --import @arthur/core/testing --test packages/delivery/test/merge.test.ts test/onboarding-merge.test.ts`: 24 tests, 23 pass, 0 fail, 1 skipped (no systemd user manager).
- `node --import @arthur/core/testing --test test/structure.test.ts`: 15 pass, 1 fail (the budget failure in finding 1).
- `wc -l` of `packages/delivery/src` on base and on the branch: 1434 and 1436.
- Base `merge-command.ts` with the new tests: both new tests fail, as the ticket requires.
- Mutation `> 10` → `>= 10`: caught.
- Mutation removing the truncation (`strays.join(", ")`): caught.
- Mutation `> 10` → `> 11`: not caught (finding 2).
- Every mutation was restored with `git checkout`, and `git status --short` is clean.
- I did not run the full `npm test`, as you instructed.

FAIL