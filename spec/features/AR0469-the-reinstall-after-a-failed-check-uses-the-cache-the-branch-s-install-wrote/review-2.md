# AR0469 - Review 2

- Job: 2026-10-27-review-9945b0a9
- Branch: arthur/2026-10-27-worker-5893b900
- Commit reviewed: 6d6dc58acb7f5b0e80a3681ec16b76a3b40d2382
- Verdict: FAIL

## Final message

The fix is correct in the code, but its tests miss the regression review-1 was about, so this round fails.

## Findings

1. **`packages/delivery/src/merge-command.ts:157`: no test catches it if the reinstall builds its own step runner again. That is exactly the review-1 bug, and the criteria count an uncaught mutation as a FAIL.**
   - **Mutation:** in the `reinstall(...)` call I replaced `runner` with `(f: string) => stepRunner(root, host.jobs.slice, console.log, mode.stepSeconds)(host.sandbox(root, f, console.log))`. The reinstall then takes a fresh `.git` list, as `f4166184` did.
   - **Result:** `node --test --test-name-pattern="a failed check resets main" packages/delivery/test/merge.test.ts` still passed (1 pass, 0 fail).
   - **Why the new test misses it:** the new test in `merge-checks.test.ts:127` calls `stepRunner` directly. It proves two runners built from one `runs` share a list. It never checks that `merge` hands the reinstall that same `runs`.
   - **A second claim is untested:** `merge.md` says a failed check prints one `uncapped:` line per merge. The failed-check test in `merge.test.ts` cannot check that, because `load()` moves every `uncapped:` line into `uncapped` (`merge.test.ts:100`), and that test never asserts it.
   - **Fix:** in the failed-check test, assert `uncapped.length <= 1` (2 under the mutation on a host without a user manager). Better, add a merge-level test where something the checks left behind writes `late/.git` before the reinstall's step ends. For example, the fake `bun` waits on the second call until `late/.git` exists, and the test then asserts it is removed and the removal line is printed.
   - **For comparison:** the wider mutation, where every runner builds its own `stepRunner`, is caught, but only by `merge.test.ts:191` counting `uncapped:` lines on a merge that passes.

## The review-1 finding: fixed in the code
- `stepRunner` (`merge-checks.ts:24-48`) runs the probe and takes `before = repositories(root)` once. It returns `(sandbox) => Run`. `merge` builds one `runs` after the merge commit lands and before the first step, and gives it to both `mainChecks` (`runner(cache)`) and `reinstall` (`runner(fresh cache)`).
- **A `.git` that appears late:** one written after the checks' last cleanup scan (for example by a process left running when there is no user manager) is now compared with the first list and removed after the reinstall's step. Confirmed by the new test and by the mutation below.
- **A `.git` the checks could not remove:** it is still missing from `before`, so the reinstall tries it again and names it again.

## Does sharing the list open a new gap? None found
- **Reset:** `git reset --keep` between the checks and the reinstall cannot create a `.git`, since Git refuses a path with a `.git` part. It can only remove a tracked one, and a removed path is simply not listed again.
- **Main's own `.git` folders:** the first list holds only those, because it is taken before any step. The stamp check still removes any of them a step changed, during the checks or the reinstall. That is the same rule as on the base commit, where one runner served both.
- **Unit numbers:** `count` is shared, so the reinstall's scopes get new names (`-n` keeps counting). One probe per merge means no reused `-0` probe unit.
- **Probe result:** it is taken once, so the reinstall uses the same capped or bare mode as the checks, as on the base commit.
- **`no sandbox:` line:** it still repeats before the reinstall, because `host.sandbox` writes it each time it is called (`job-sandbox.ts:99,117`). `merge.md` says so.

## Notes
- The delivery budget of 1591 is recorded (AR-D158, AR-D162), so it is not a finding.
- The fresh-cache part from round 1 is unchanged: `mkdtempSync` in `host.folder`, removed in `finally`, and the `notEqual` assertion in the merge test.

## Checks
- `npm run check` (tsc): no errors printed. The background job's exit code 1 came from my output filter (it was written for TAP, and the spec reporter printed no line it matched), not from tsc.
- `node --test --test-reporter=tap packages/delivery/test/merge.test.ts packages/delivery/test/merge-checks.test.ts test/structure.test.ts`: 50 tests, 49 pass, 0 fail, 1 skipped (the systemd scope test: no user manager here). Matches the worker's numbers.
- Full `npm test`: not run by me. The host reported 1201 tests, 1195 pass, 0 fail, 6 skipped.
- **Mutation 1:** in `stepRunner`, take `before` again for each sandbox. The new test fails ("not ok 1 - the reinstall's runner…"), so it is caught. Restored.
- **Mutation 2:** in `merge-command.ts`, `runner` builds a new `stepRunner` each time. `merge.test.ts` test 3 fails (two `uncapped:` lines), so it is caught. Restored.
- **Mutation 3:** in `merge-command.ts`, only the reinstall builds a new `stepRunner` (finding 1). The failed-check test passes, so it is **not caught**. Restored.
- `git status --porcelain` is empty after the restores.

FAIL