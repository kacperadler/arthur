# AR0469 - Review 3

- Job: 2026-10-27-review-13a094c1
- Branch: arthur/2026-10-27-worker-5893b900
- Commit reviewed: 9fde26675a4aaa7972148d1d626a45f4d490f1bf
- Verdict: PASS

## Final message

The review-2 finding is fixed. When I put the review-2 mutation back, both new tests in `packages/delivery/test/merge.test.ts` fail. The new test's timing comes from the order the code runs in, so it holds on every host. All checks you allowed pass, and I found nothing that blocks the merge.

## Findings

None.

## The review-2 finding: fixed
- **Mutation:** in the `reinstall(...)` call at `merge-command.ts:158`, I replaced `runner` with `(f: string) => stepRunner(root, host.jobs.slice, console.log, mode.stepSeconds)(host.sandbox(root, f, console.log))` and ran the two tests by name. Result: 2 tests, 0 passed, 2 failed.
  - **Test 1** (the failed-check test) failed on "one probe for the whole merge, the reinstall's runner included". It printed two `uncapped:` lines because this host has no user manager (`systemd-run --user` gives "Failed to connect to bus: Permission denied").
  - **Test 2** (the late `.git` test) failed because the line `removed late/.git, which bun install --frozen-lockfile left: …` never came before `reinstall of main's dependencies, …: passed.`
  - I restored the file with `git checkout -- packages/delivery/src/merge-command.ts`.
- **An extra mutation of my own:** in `merge-checks.ts`, `stepRunner` took a new `.git` list for each sandbox instead of one for the whole merge. Test 2 failed on that too. Restored with `git checkout -- packages/delivery/src/merge-checks.ts`; `git status --porcelain` was then empty.

## Test 2's timing holds on every host
- `step()` in `merge-checks.ts:170-178` calls `run()` first. `run()` starts the command, stops the scope where there is one, then sweeps for `.git` folders (`merge-checks.ts:41-49`). Only then does `step()` log `npm test: failed…`.
- The test's `console.log` mock is synchronous, so `hear` runs `git init late` with `execFileSync` after the checks' last sweep and before `step()` returns.
- After that come `git reset --keep`, which leaves the untracked `late/` alone (the test checks `late/` stays), and then `reinstall`, which is the first moment a runner for the reinstall can exist.
- None of these steps depends on the host:
  - **User manager:** with one, the scope stops inside `ran`, before the sweep.
  - **Sandbox:** whether or not there is one only changes the command `ran` builds.
  - **Wall-clock time:** nothing in the order waits on a timer.
- Under the mutation, the new runner's first look already sees `late/.git`, so nothing removes it. Test 2 therefore catches the regression on hosts with and without a user manager. Test 1's `uncapped.length <= 1` only catches it on a host without one, as the worker's message says.

## Notes
- `hear` is set only after `worker` and `review`, so it fires only during the merge, and `load()` starts fresh for each test.
- The worker's claims match what I saw: the mutation and both failure messages, `tsc` exit 0, and no source change in `9fde2667`.

## Checks run
- `npm ci`: exit 0.
- `npm run check` (`tsc`): exit 0, no errors.
- `node --test --test-reporter=tap packages/delivery/test/merge.test.ts packages/delivery/test/merge-checks.test.ts`: 35 tests, 34 passed, 0 failed, 1 skipped. Tests 25 and 26 in `merge.test.ts` (failed check, late `.git`) passed, as did `merge-checks.test.ts` test 6 (the reinstall's runner sweeps against the first look).
- Review-2 mutation on test 1 and test 2 together: 2 tests, 0 passed, 2 failed. Restored.
- Per-sandbox-list mutation on test 2: 1 test, 0 passed, 1 failed. Restored; `git status --porcelain` empty.
- Full `npm test`: not run, as you said.

PASS