# AR0533 - Review 1

- Job: 2026-10-28-review-ea20f672
- Branch: arthur/2026-10-28-worker-a79493ce
- Commit reviewed: 5b67497131349685b8b488ef1c927c21fd21edff
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0533 asks: a merge decision now lets through only the merge flags its `--what` recorded when it was asked.

**What the branch does, checked against "Done means"**
- **The flag is recorded at ask time.** `packages/orchestration/src/decision-commands.ts:71-73` accepts `--what` (repeatable) only as `--unreviewed` or `--no-ci`, and only with `--kind merge`. `packages/orchestration/src/decision-log.ts:168` keeps `what` in the `ask` record.
- **`decision.owner` refuses a flag the decision does not name.** `packages/orchestration/src/decision-use.ts:47` checks this before the decision is marked used. So `arthur merge <job> --unreviewed --no-ci --decision <id>` on a decision asked only for `--unreviewed` is refused on the `--no-ci` call, even though the same merge has already used it. `arthur take-main` (use `take-main …`) is left out, as the ticket says.
- **Tests:** `decision-use.test.ts` has the new test: a decision for `--unreviewed` refuses `--no-ci`, one asked with both allows both, one asked without `--what` refuses, take-main still passes, bad asks write nothing, and a hand-edited `what` is caught. `merge.test.ts` adds the F2 case: `--no-ci --decision` on a branch with no PASS is refused, `decision.owner` is never asked, and main is unchanged.

**Bypass angles I looked at; none open**
- **Flag order:** `--unreviewed` is checked before `--no-ci`. A decision asked only for `--no-ci`, used with both flags, is refused on `--unreviewed`.
- **Same merge twice:** the check runs before the used-mark check, so an `EEXIST` re-pass cannot skip it.
- **take-main decisions:** they have no `what`, so they can no longer be used for a merge.
- **Wrong case, `--what` without `--kind merge`, `--kind` given twice:** all rejected by the parser or the usage check.
- **Hand edits:**
  - `"what": "--no-ci"` (a string, not a list) is caught as a broken record.
  - `"what": null` is read as no flags, so the decision is refused; that is the safe direction.
  - A coordinator hand-editing `spec/decisions.jsonl` to add a flag is the same threat as forging an answer, which AR0502 covers, not this ticket.

**Notes (not blocking)**
- **Old decisions stop working:** every merge decision asked before this change, answered but not used yet, now refuses. The worker flags this; the coordinator has to ask again with `--what`.
- **Bad `--what` gives only the usage line:** the check sits inside the `words` condition (`decision-commands.ts:73`), so a bad `--what` exits 2 with no message naming the reason. The worker chose this to stay inside orchestration's 2430-line budget (exactly at 2430 now). The variable name `words` also no longer describes what it holds.
- **Files outside the Scope list:** `packages/delivery/docs/commands/merge.md`, `packages/orchestration/roles/coordinator.md` and `packages/projects/roles/coordinator/onboarding-ended.md` changed. The final message gives the reason: they tell the coordinator how to ask, and the ask now needs `--what`. `merge.md` is also the help page for the changed hint.
- **Unclear doc wording:** in `decision.md` the no-id hint reads `--kind merge --what <flag>|budget`, which is easy to misread.

**Checks run**
- `npm ci`: exit 0.
- `npm run check`: exit 0 (tsc).
- `npm test`, run twice (foreground, then logged to a file): both 1231 tests, 1170 pass, 0 fail, 61 skipped, exit 0. Matches the worker's claim.
- Orchestration size: `cat packages/orchestration/src/*.ts | wc -l` → 2430, at its budget. `decision-log.ts` is 200 lines, `decision-commands.ts` 162.
- **Mutations**, run against `decision-use.test.ts` and `decisions.test.ts` (and `merge.test.ts` for delivery). Each was caught, then restored with `git checkout`:
  - Flag check removed (`if (false)`): 1 fail.
  - `includes(what)` replaced with "any `what` at all": 1 fail.
  - Check skipped once the used mark exists: 1 fail.
  - `--what` dropped from the no-id hint: 1 fail.
  - `--kind merge` condition dropped from the ask check: 1 fail.
  - Flag-value condition dropped from the ask check: 1 fail.
  - `--what` no longer repeatable: 1 fail.
  - `what` not passed to `ask()` in `decision-commands.ts`: 3 fail.
  - `what` not kept in `decision-log.ts` `ask()`: 3 fail.
  - `what` validation removed from `problem()`: 1 fail.
  - Scope check changed to `kind === "merge"` (which hits take-main): 1 fail.
  - `&& mode.ci` added to the PASS-gap condition at `merge-command.ts:127`: `merge.test.ts` "a plain merge asks github.ci …" fails.
  - One more mutation, `!use.startsWith("take-main") && kind === "merge"`, passed. It behaves the same as the original, so no test can catch it.
- The worktree was clean after all restores (`git status --short` empty), and the log file I wrote was deleted.

PASS