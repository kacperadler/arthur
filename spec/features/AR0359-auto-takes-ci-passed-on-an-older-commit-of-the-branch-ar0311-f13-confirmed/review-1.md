# AR0359 - Review 1

- Job: 2026-10-25-review-b0d24968
- Branch: arthur/2026-10-25-worker-e400170e
- Commit reviewed: 9b549c9be86413d5739880ef50c8cfe6555a2e09
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0359's Done means asks, and the worker's claims all reproduced when I ran them myself.

- **The merge** (`packages/delivery/src/auto-merge.ts:65`): `--auto` now counts a run only when `run.below !== 0` is false, meaning the run is on the tip itself. A run below the tip, whether on main or on an older commit of the branch, counts as no run. In that case the code calls `startWait` and refuses with `no run built the tip yet`, adding `(the nearest, <id>, ran on <sha>, <k> below the tip)` when there is a nearer run. A plain merge still reads the branch's own commits through `own` (line 63), as AR0362 set it.
- **The wake** (`packages/delivery/src/ci-wait.ts:75`): `ciEnded` wakes the coordinator only for `below !== 0` false, so only for a run on the tip.
- **The tests:**
  - The test that used to merge on a run 1 below the tip (`auto-merge.test.ts:214-239`) is inverted. It now expects the exact refusal and a wait. A `delivery.ciEnded` end with `below: 1` answers `[false]` and sends no message, as the ticket's `:226` point asks.
  - The CI cases at `:183-208` now expect the new text for a run on main and for no run.
- **The doc** (`docs/commands/merge.md`, "--auto"): it states the cost the ticket accepts, the `[skip ci]` and `paths-ignore` cases, and that such a branch waits for the owner's `--auto --no-ci`. The wake paragraph now says only a run on the tip (`below` 0) wakes.
- **Outside the code:** the only change is `findings.md` with F1, which the final message explains. The commit is one Conventional Commit, `fix(AR0359): …`.

## Notes
- F1, which the worker filed, is accurate. `Wait.own` is now read only by the 30-minute cancel in the wait's round (`ci-wait.ts:113`). That cancel still stops a hung run below the tip, and since `ciEnded` no longer tells that run's end, the coordinator hears of it only through github's wake, without being told delivery cancelled it. This is left open for the coordinator to settle.
- `ciRefusal` trusts github's `below === 0` and never compares `run.sha` with the `tip` delivery read. Both come from `refs/heads/<branch>` read at slightly different moments, and a job still in a run is refused before this point, so I see no practical way around it. Comparing `run.sha === tip` would be stricter. The ticket did not ask for it.

## Checks run
- `npm ci`: 22 packages added.
- `npm run check` (tsc): no errors.
- `npm test`: 1125 tests, 1067 pass, 0 fail, 58 skipped.
- `wc -l`: `auto-merge.ts` 76 lines, `ci-wait.ts` 147, both under 200. The structure tests passed inside `npm test`.
- Mutations, each run against `packages/delivery/test/auto-merge.test.ts`:

| Mutation | Result |
|---|---|
| `auto-merge.ts:65` `run.below !== 0` → `run.below > 1` | 2 tests fail (the `--auto` CI test and "CI passed on the tip after a new commit") |
| `auto-merge.ts:65` → the old `run.below >= own` | 1 test fails ("CI passed on the tip after a new commit") |
| `ci-wait.ts:75` `below !== 0` → `below > 1` | 2 tests fail ("CI passed on the tip after a new commit" and the `delivery.ciEnded` wake test) |

- I restored each mutation with `git checkout -- <file>`. `git status --short` is clean.

PASS