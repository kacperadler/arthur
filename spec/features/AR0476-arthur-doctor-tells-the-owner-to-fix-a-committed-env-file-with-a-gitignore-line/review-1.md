# AR0476 - Review 1

- Job: 2026-10-27-review-f76e9e47
- Branch: arthur/2026-10-27-worker-de4b849f
- Commit reviewed: 347eb948a42d15e5a54b0c3316f0551d777cd5fe
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0476 asks, the checks pass in my checkout, and every mutation I tried fails the doctor test.

**What I checked against the ticket**
- `packages/core/src/requirements.ts:105-108`: when `git check-ignore -q` fails, the check now runs `git ls-files --error-unmatch -- <name>`. A tracked file gets its own `missing:` line: `is tracked by the Git checkout <top>, so no .gitignore line ignores it, and every commit that holds it keeps its values`.
- `requirements.ts:111`: for a tracked file, the getter gives `git -C <folder> rm --cached -- <name>, commit, and rotate every value it held`. This is the fix the ticket's Scope asks for. A file that is not tracked keeps the old text and fix, and the check is still `critical: true`. The getter works the way `core controllers` already does at line 86. `doctor.ts:69-70` and `setup.ts:78` read `fix` after `check`, so they get the fix for the current case.
- `packages/core/test/doctor.test.ts:217-224`: the old row is gone. The test now commits the file and expects the tracked line and exit 1. It then untracks the file and expects `ok`, because `.gitignore` lists `env`. Last, it empties `.gitignore` and expects the untracked line again, so both cases and the switch between them are covered.
- `packages/core/docs/commands/doctor.md:32`: describes the tracked case, its text and its fix. It no longer claims that a tracked file is simply "not ignored" without saying what to do.

**Notes (not blocking)**
- `requirements.ts:31` and `:111` are packed to stay inside the core's line budget of 6414 without recording a raise: `let [manager, tracked] = [true, false]`, `const [folder, name] = …`, and a getter on one line next to the multi-line one at line 86. The worker says why in the final message. It is legal, but harder to read than raising the budget with a recorded decision.
- A file that is only staged with `git add -f` and never committed also gets the advice to rotate. The worker reported this, and the ticket's Scope names exactly the `ls-files --error-unmatch` test, so it is not a departure.
- The printed fix puts `dirname(envFile)` into a shell command without quotes, so a path with spaces breaks it if pasted as is. The existing `.gitignore` fix already uses the bare name the same way.

**Checks run**
- `npm ci`: passed, 22 packages added.
- `npm run check` (`tsc`): exit 0, no output.
- `npm test`: 1222 tests, 1161 passed, 0 failed, 61 skipped, about 468 s. This matches the worker's numbers.
- Baseline, `node --import @arthur/core/testing --test --test-name-pattern="Git checkout that does not ignore" packages/core/test/doctor.test.ts`: 1 passed, 0 failed.
- Mutations on `requirements.ts`, each run with that test and then restored with `git checkout --`:
  - dropped `--error-unmatch`, so `ls-files` always exits 0: fail 1
  - getter always gives the old `.gitignore` fix: fail 1
  - `tracked` inverted (`!(await ran(...)).ok`): fail 1
  - message always the old "lies in" text: fail 1
- After the restores, `git status --short` is clean.

PASS