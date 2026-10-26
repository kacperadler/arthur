# AR0439 - Review 2

- Job: 2026-10-26-review-5faebd77
- Branch: arthur/2026-10-26-worker-c54d4fe8
- Commit reviewed: f9c68cce3f5e319aeb264f63b8d8bf4b9c891785
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0439 asks: `arthur doctor` warns about each known provider key set in Arthur's environment, and `docs/deploy.md` says the same.

**Findings**

None.

**Notes (not blocking)**
- `packages/core/src/requirements.ts:13`: the list of 19 provider keys is written into the code. I did not check it against the variables omp actually reads. The ticket's "and the like" leaves room for that, and the list matches `doctor.md` word for word.
- The ticket's scope names `packages/core/src/doctor.ts`, but the change is in `requirements.ts`. That is where `coreRequirements` lives, the function that holds the core's doctor checks, so this is the right place even though the final message doesn't say why.
- The core line budget goes from 6228 to 6238 in `test/structure.test.ts:709`. The ticket's decision AR-D61 allows this, and the comment there cites it.
- How it works:
  - The new `env` parameter defaults to `process.env`.
  - A warning appears only for a variable that is set and not empty.
  - The warning is not critical.
  - The check, cost and fix text name the variable and never its value. The fix points to `omp login`/`~/.omp` or the models plugin's `prepare`, as the Done means asks.
- The test is not happy-path only. It covers:
  - One key set, plus an `ARTHUR_` decoy with the same value.
  - Two keys set, in order.
  - No key set.
  - A key set to an empty value.
  - The value missing from both stdout and stderr.

  It runs the real CLI with a clean environment (`project()` passes only `PATH` and `XDG_CONFIG_HOME`), so the reviewer's own shell cannot change the result.
- The final message's claims hold:
  - The comment cites AR-D61 and the budget is 6238.
  - The diff touches only the five files listed.
  - The merge from main added no code to the reviewed range.

**Checks run**
- `npm run check`: tsc finished with no errors.
- `node --import @arthur/core/testing --test packages/core/test/doctor.test.ts test/structure.test.ts`: 30 tests, 30 passed, 0 failed.
- The new test with the base commit's `requirements.ts` swapped in fails (1 test, 1 fail), so it meets "fails on main".
- I mutated the code four times and ran the new test after each (`--test-name-pattern="model provider"`); each run ran 1 test, which failed:
  1. Filter changed to `key in env`, so an empty value also warns.
  2. Filter inverted.
  3. The value put into the warning text.
  4. `critical: true` added.

  After each one I restored the file with `git checkout --`, and `git status` was clean at the end.
- As instructed, I did not run the full `npm test` or `npm ci`.

PASS