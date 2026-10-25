# AR0362 - Review 1

- Job: 2026-10-25-review-b12fbfb2
- Branch: arthur/2026-10-25-worker-d80254e2
- Commit reviewed: a365f3e3637d2b877399c85739861a5adbb217cf
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch covers every point the ticket's Done means asks for, and every mutation I ran was caught by the tests.

## Findings

None.

## Notes (do not block)

- **Double prefix in the refusal**, `packages/delivery/src/auto-merge.ts:56`. The rule is worded `arthur merge merges only with CI passed on the branch`, so the printed error reads `arthur merge: arthur merge merges only …`. The ticket asked for the `--auto` line "reworded for the merge", so this meets it. It reads awkwardly but does not mislead.
- **Line budget raised**, `test/structure.test.ts`. Delivery goes from 1321 to 1327, with the reason in a comment that names AR0362. AR-D29 on main lets the coordinator raise a budget itself when a fix needs one, and the final message reports the raise.
- **Behaviour the ticket did not name.** When github is loaded but cannot answer (the 401 case), a plain merge goes ahead. The worker reads this as "the owner's merge waits for nothing" from the ticket, the docs say it, and the test covers it.
- **`--unreviewed` merges ask CI too.** The new path runs for `--unreviewed` as well as a plain merge (`merge-command.ts:88`). That fits "a plain merge" as `--unreviewed` is not `--auto`, and the docs list `--no-ci` as the only way past it.
- **Older failed run.** A failed run on an older commit of the branch, with no run yet on a newer tip, refuses a plain merge. This follows the ticket's "a run on the branch's own commits", and `--auto` reads it the same way.

## Checks I ran

- **`npm ci`**: added 22 packages.
- **`npm run check`** (tsc): no errors.
- **`npm test`**: 1125 tests, 1067 pass, 0 fail. The remaining 58 are neither passed nor failed; I did not check what they are.
- **Files and docs:** `auto-merge.ts` is 76 lines and `merge-command.ts` is 150, both under 200. Every doc the final message names changed as it says: `merge.md`, `coordinator.md:26`, `README.md`, `plugin-api.md`, `github.md`. The test at old `:312`, now `:376`, is updated.
- **Mutations**, each run with `node --test test/merge.test.ts test/auto-merge.test.ts` in `packages/delivery`, then restored with `git checkout`. Every one was caught:

| Mutation | Tests failed |
|---|---|
| Plain merge: `run.below >= own` changed to `run.below > own` | 1 |
| Plain merge: pending-run pass dropped | 1 |
| Plain merge: `run === undefined` pass dropped | 1 |
| Plain merge never asks CI | 1 |
| `--no-ci` ignored (`ci: true`) | 2 |
| Plain merge refuses when github is not loaded | 14 |
| Plain merge refuses when github cannot tell | 1 |
| `--no-ci` without `--auto` made wrong usage again | 2 |
| `conclusion !== "success"` changed to `=== "failure"` | 1 |

- **Checkout state:** after the mutations, `git status --short` is empty and HEAD is a365f3e3.

PASS