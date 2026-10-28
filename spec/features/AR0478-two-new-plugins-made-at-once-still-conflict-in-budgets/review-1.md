# AR0478 - Review 1

- Job: 2026-10-28-review-e338f94a
- Branch: arthur/2026-10-28-worker-6ece3b9a
- Commit reviewed: 464badbdce119f66f309c9f222335da6ee1ad7ad
- Verdict: FAIL

## Final message

I'm failing this branch. The code puts a new budget in name order and the new test passes, but the doc it changed says something false about when Git still conflicts, the worker's message says the doc says something it doesn't, and one mutation of the name matching goes uncaught.

## Findings

1. **`packages/develop/docs/commands/plugin.md:30`: the doc gives the wrong condition for a conflict.** It says two new plugins merge cleanly "unless no budget's name sorts between their two names". `BUDGETS` isn't sorted, so the real condition is different: two names conflict when the same existing budget is the first one that sorts after each of them. I tested this in a temp copy of `test/structure.test.ts` using the branch's insertion code and `git merge-file -p`:
   - `delta` + `nebula`: exit 1, a conflict, even though `develop`, `findings`, `github`, `machines`, `manage` and `models` all sort between them. Both go in front of `projects`.
   - `gitlab` + `nebula`: exit 1.
   - `delta` + `slack`: exit 0.

   Every name between `"core/testing"` and `projects` (most of d through p) lands in the same place. So the ticket's goal, that two branches each making a plugin merge without a conflict, holds only for some name pairs. The test passes because `acme`, `orbit` and `zeta` happen to land in three different places. The owner reading this page would expect clean merges where there are none.

2. **The worker's message doesn't match the doc.** It says "every name between 'core/testing' and 'projects' goes in front of `projects`. The doc page says this." The doc doesn't say this; it says the false condition above. The message also repeats that condition ("if no existing budget's name sorts between the two new names…"). The review criteria require the final message's claims to match the branch.

3. **`packages/develop/src/plugin-new.ts:100`: a mutation the tests don't catch.** I replaced `/^\t"?([^":]+)/gm` with `/^\t([^":]+)/gm`, so quoted budgets like `"core/testing"` and `"commit-rules"` are no longer compared. `plugin-new.test.ts` still passed 7 of 7. With that mutation, a name like `core-x` (which should go before `"core/testing"`, since `/` sorts after `-`) lands before `projects` instead, and no test notices. The test needs a name whose first later budget is a quoted key.

Two fixes would resolve 1 and 2:
- **Sort `BUDGETS` once.** This doesn't change its form (one per line, a blank line after each), and it makes both "name order" and the doc's condition true.
- **Or correct the doc and the message** to the real condition, and record in the ticket's Decisions that the goal is only partly met.

## Notes
- The worker's budget raise to 710 is covered: main's ticket records the owner's decision (AR-D225).
- The inner `const at` in `plugin-new.ts:100` shadows the outer `at` (the `--root` value). It works, but it's easy to misread.
- The worker's Decisions line in the ticket repeats the owner's existing line on main for the raise.

## Checks run
- `npm ci`: added 22 packages.
- `npm run check` (`tsc`): no errors.
- `npm test`: 1227 tests, 1166 pass, 0 fail, 61 skipped. This matches the worker's numbers.
- Mutations, each run against `packages/develop/test/plugin-new.test.ts` and then restored with `git checkout`; `git status --porcelain` was empty afterwards:
  - The regex without `"?`: 7 pass, 0 fail, **not caught**.
  - `> name` changed to `< name`: 4 fail, caught.
  - The fallback `entries.length` changed to `0`: 1 fail, caught.
- Collision experiment with the branch's insertion code and `git merge-file -p` in a temp folder, removed afterwards: results as in finding 1.
- All background jobs I started have finished.

FAIL