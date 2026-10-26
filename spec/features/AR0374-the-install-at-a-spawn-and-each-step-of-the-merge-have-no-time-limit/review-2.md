# AR0374 - Review 2

- Job: 2026-10-27-review-522aaa69
- Branch: arthur/2026-10-26-worker-5ba085de
- Commit reviewed: 8fba5b407ff02323f55fce9ac4b0611a68e2ec56
- Verdict: PASS

## Final message

The merge in 8fba5b40 is clean. AR0463's `.git` sweep and AR0374's step time limit both come through intact, and the delivery budget line is right. I found no problems.

**Notes (not blocking):**
- `packages/delivery/src/merge-checks.ts` matches main's version except for the AR0374 lines: `timeout: limitSeconds * 1000`, `killSignal: "SIGKILL"`, the `ETIMEDOUT` error rewritten to `timed out after <n> s`, and the header comment. Compared with the branch's own side, the only additions are main's sweep (`repositories`, `stamp`, `entries`, `remove`, and the loop run after each step) and the rename of the inner `ran` to `spawned`. The sweep wraps the step that has the limit, so a step that times out is still swept.
- The one production caller, `merge-command.ts:124`, passes `mode.stepSeconds`. All three `stepRunner` calls in the test now pass a limit: 60, 1, 60.
- The only difference between main's `BUDGETS` and the merge's is delivery, 1500 → 1513. That is main's 1500 plus AR0374's +13, and `cat packages/delivery/src/*.ts | wc -l` prints 1513.
- In `merge.md`, step 2 keeps main's sweep sentences and adds the `merge.stepSeconds` / `failed, timed out after <n> s.` sentence. The usage line names the option.
- `ticket.md` takes AR-D110, AR-D111 and AR-D74 from main as they are and adds the two worker Decisions lines. Its text matches the ticket on main at 2e4e68ff.
- F1 in `findings.md` is still open: a second `arthur merge` started during the first's checks would merge on top of its unchecked commit. Nobody has reproduced it.

**Checks:**
- `npm run check`: tsc clean.
- `node --test packages/delivery/test/merge-checks.test.ts packages/delivery/test/merge.test.ts`: 28 tests, 27 pass, 0 fail, 1 skipped. This matches the worker's claim.
- Mutation: I removed `timeout`/`killSignal` from the step options. The SIGKILL limit test failed, 1 of 5.
- Mutation: I made the sweep skip every `.git` (`continue;` unconditionally). All three sweep tests failed, 3 of 5.
- I restored both mutations with `git checkout`; `git status --short` is empty.

PASS