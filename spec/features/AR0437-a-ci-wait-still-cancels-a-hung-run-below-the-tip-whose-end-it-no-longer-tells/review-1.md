# AR0437 - Review 1

- Job: 2026-10-29-review-972a504a
- Branch: arthur/2026-10-29-worker-9f0f2fde
- Commit reviewed: 5e8071a918cd82aa4c64fb0a03ecac7b1aea0033
- Verdict: PASS

## Final message

The branch does what AR0437 asks and passes. It keeps cancelling a hung run on the branch's own commits. `ciEnded` now tells the end of a run delivery cancelled at any depth, with `cancelled by delivery after it ran 30 minutes`. For `--auto`, `ciRefusal` waits unless `run.sha` equals the tip it read, even when github says `below: 0`. The plain merge is unchanged.

## Findings

None that block the merge.

## Notes

- **Merge conflict in the ticket, no disagreement.** `ticket.md` (the Decisions line the branch adds): the worker's hand-written line and main's AR-D291 line both record the same raise, 1631 → 1636. They say the same thing, but `git merge-tree 07d15ce 5e8071a` reports a text conflict in this file. To resolve it, keep main's AR-D291 line and drop the branch's copy. `test/structure.test.ts` merges cleanly with main's core budget raise to 6440, and main has no delivery changes since the base.
- **F2 is real and comes from this change (worker's finding, open).** `packages/delivery/src/ci-wait.ts:63`: if a run cancelled below the tip still ends `success` because the cancel came too late, the wake says `CI passed … It waited for that: arthur merge --auto <job>`. That `--auto` then refuses and starts the wait again. The refusal explains itself and no work is lost, so this is a misleading message only.
- **A failed cancel is still labelled as delivery's cancel.** `ci-wait.ts:120`: the round records `<key> cancel` before it calls `github.cancel`. If the call throws and the run later ends by itself, the wake still says `cancelled by delivery after it ran 30 minutes`. This already happened at the tip; it now happens below the tip too. Small, and not in the ticket.
- **F1 is correct and was there before this branch.** The plain merge starts a wait for a run that passed 1 below the tip. Lines 64–66 are unchanged except for the new check, which applies only to `--auto`. The ticket leaves the plain merge out of scope.
- **The worker's claims match what I see:** the docs in `merge.md` match the code, `ci-wait.ts` is 150 lines and `auto-merge.ts` 78, and the commit message follows Conventional Commits with the ticket id as scope. No names of real clients or projects.

## Checks

- `npm ci`, then `npm run check && npm test` in one call:
  - `tsc` is clean.
  - Tests: 1271, pass 1209, fail 0, skipped 62 (no systemd, tmux refused). This matches the worker's numbers.
  - My first run of this command exited 1, but it was my own `| grep` matching no line, not a failure. The rerun without the grep exited 0.
- `node --test packages/delivery/test/auto-merge.test.ts`: 8 of 8 pass.
- Mutations, each restored with `git checkout -- <file>`; `git status` was clean at the end. All were caught:

| Mutation | Tests that failed |
|---|---|
| `ciEnded` back to main's `if (below !== 0) continue;` | new 1-below-tip test (so it fails on main) |
| Below-tip skip disabled (`if (false)`) | 3 tests |
| `&&` turned into `\|\|` (only a cancelled tip run told) | 2 tests |
| `(auto && run.sha !== tip)` removed | `--auto CI` test |
| Sha check made unconditional | plain-merge assertion |
| Round cancels only the tip's run (`run.below !== 0` instead of `>= wait.own`) | new test (no cancel) |
| Cancel line left off below the tip (`ended(…, below === 0 && cancelled)`) | new test (message) |
| Cancel matched per run id, not per attempt | `a rerun delivery did not cancel stays github's` |
| Told-once check removed | 2 tests |

- The branch's M1 and M2 mutation runs overlapped by mistake. M1's result stands, because M2's `sed` could not match after M1's edit. I reran M2 on its own and got 3 failures.

PASS