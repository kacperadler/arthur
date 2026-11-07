# AR0644 - Review 3

- Job: 2026-11-07-review-6fe9b6e2
- Branch: arthur/2026-11-06-worker-926f0a0f
- Commit reviewed: 5be8cc1cb3a4a68103f1f07438f90170a64c3924
- Verdict: PASS

## Final message

The merges are clean, both budgets match their decisions, and none of the five mutate survivors is a real gap in the tests. Nothing blocks the merge.

## Findings
None.

- **Merges:** the base `1f25ecfc` is both main's tip (`5be8cc1c^2`) and the merge base. So the four merged files (`README.md`, `arthur.mmd`, `docs/plugin-api.md`, `test/structure.test.ts`) differ from main only by this branch's lines, and none of main's content was lost.
  - `README.md` is still 120 lines, the same as main. The only changes are that cleanup hooks left the planned list and now appear in the core box.
  - In `arthur.mmd`, the runner node now lists cleanup hooks. The `corelater` node is gone from its definition, its `~~~` chain and its `class … planned` list, so nothing refers to it any more.
  - `docs/plugin-api.md` gains the `jobs.cleanup(fn)` row and the "one after another" wording on `jobs.prune`. The AR0644 entry comes after main's entries.
- **Budgets:** `test/structure.test.ts:16` raises `core` from 7387 to 7438 (AR-D550). `test/structure.test.ts:20` raises `delivery` from 2219 to 2220, main's number plus one (AR-D550). Both match the ticket's Decisions.
- **Mutate survivors** (run on `5be8cc1c`):
  - `packages/core/src/host-jobs.ts:18` is a comment, and `host-jobs.ts:19` and `host-jobs.ts:34` are type members. Node strips both, so no test can see these mutants; `tsc` checks the types.
  - `packages/core/src/jobs.ts:75` is the type member `cleanup(owner, fn, limitMs?)`. Same reason: tests cannot see it, `tsc` checks it.
  - `packages/core/src/job-commands.ts:46` changes `-1` to `-2`. The only reader is `job-commands.ts:74`, which tests `count >= 0`, so `-1` and `-2` behave the same. The mutant is equivalent.

## Notes
- (minor) `packages/delivery/src/merge-command.ts`: it is 220 width-counted lines, at the top of yellow. The branch changed one line there and the file's line count is unchanged from main. One more counted line would take it into red.

## Checks (on `5be8cc1c`)
- `npm run check`: `tsc` passed with no errors.
- `node --import @arthur/core/testing --test test/structure.test.ts`: 20 tests, 20 passed, 0 failed. Seven files print as yellow; none is red or over budget.
- I did not rerun the full `npm test` or `npm run mutate`, as you instructed. Their results (1583 pass, 0 fail; 25 mutants, 20 caught, 5 survived) come from the worker's run on this same tip.

PASS