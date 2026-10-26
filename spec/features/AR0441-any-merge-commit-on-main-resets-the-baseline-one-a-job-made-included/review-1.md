# AR0441 - Review 1

- Job: 2026-10-26-review-90e39cf1
- Branch: arthur/2026-10-26-worker-3b5515b3
- Commit reviewed: 0b318e17abee4788c0d231a0f04f4be054917f49
- Verdict: PASS

## Final message

No blocking findings. The range does what AR0441 and AR-D67 ask, the checks pass, and every mutation of a key behavior made a test fail.

## Findings
None.

## Notes (non-blocking)
- **F2 bypass (open, confirmed by reading only, not run):** `packages/delivery/src/take-main.ts:55` sends `decision.owner` an ask with no ticket, no job and no project. In `packages/orchestration/src/decision-use.ts`, `refusal` matches only kind and ticket/job, so any answered `merge` decision with no ticket and no job passes, from any project's log. That means a decision the owner recorded for one project can lift the refusal in another. The worker logged this as F2 (`Status: open`), the fix belongs in orchestration (outside this ticket's Scope), and the merge turns the open entry into a planning ticket. So it does not block.
- **Missing record still falls back:** with no `last-merge` file, or one without a full hash, the check falls back to main's last merge commit, which a job can make. The ticket's Done means asks for this, and AR-D67 keeps it for a missing file only. A job erasing the record from inside the main checkout is the worktree guard's job (AR0331), not this diff's.
- **Changed refusal ending:** the old "first-parent line no longer passes" refusal now ends with the shared `arthur take-main lifts it` tail. The worker flagged this; it matches AR-D67's "both refusals work the same way", and `merge.md` documents it.
- **Detached HEAD:** `take-main` records HEAD without checking that main is checked out. On a detached HEAD it records that commit; `arthur merge` already refuses a detached HEAD before reading the record.
- **Scope:** beyond the Scope list, the range touches `delivery.ts` (registering the command), the new `take-main.md` and a one-paragraph `orchestration/docs/commands/decision.md` addition. The criteria require a doc page for a new command, so these are justified. `take-main` has no `inJob`, so jobs are refused by default, as its doc says.

## Checks run
- `npm ci`, then `npm run check`: tsc, no errors.
- `node --test --test-reporter=tap packages/delivery/test/merge.test.ts test/structure.test.ts`: 37 tests, 36 pass, 0 fail, 1 skipped. Matches the worker's 21 (20 pass, 1 skip) plus 16/16.
- Rerun of `merge.test.ts` alone, unmutated: 20 pass, 0 fail.
- Mutations, run one at a time, each restored with `git checkout --`. Every one made a test fail:
  - `gone` refusal turned off (`false &&`): test 12 fails.
  - `off` refusal turned off: tests 12 and 16 fail.
  - `saveLastMerge` after the merge removed: tests 12 and 16 fail.
  - `saveLastMerge` moved before the checks on main: tests 14 and 16 fail.
  - `lastMerge` always answers `on`: test 12 fails.
  - Record ignored (`since` = last merge commit, the pre-ticket behavior and F1's exploit): tests 11, 12, 13, 14 and 16 fail.
  - `--no-merges` put back into the stray listing: test 12 fails.
  - Full-hash check relaxed to non-empty: test 13 fails.
  - Decision refusal in `take-main` skipped: test 13 fails.
- One early batch of three mutations ran at the same time on the same tree, so its results were mixed; I discarded it and reran each mutation alone (the results above).
- `git status --short` after all mutations: clean.
- Size: `take-main.ts` is 61 lines and `merge-command.ts` 171, both under 200. The delivery budget of 1434 matches AR-D70, and the structure test passes.

PASS