# AR0520 - Review 1

- Job: 2026-11-05-review-3a43d88b
- Branch: arthur/2026-11-05-worker-d8bfe3a6
- Commit reviewed: 8e91ff75ddbfd506845683bd090033cd6010494b
- Verdict: FAIL

## Final message

Two mutants of key limit behaviours survive, so this fails. The ticket is otherwise met in the code, but the branch has gaps in its tests.

## Findings

1. **`packages/core/src/job-machine.ts:168`: the claim that the add step no longer blocks is not tested.** The `npm run mutate` result was `survived: packages/core/src/job-machine.ts:168: hunk reverted to the base`. With that revert, `addThere` goes back to `void ssh(...)`, a `spawnSync` call. The spawn's `remote-job add` step can then freeze `arthur run` (Telegram, `/stopall`, every plugin) for up to 60 s, and every test still passes. The worker says `addThere`, `removeThere` and `launchThere` "now run asynchronously, so the spawn … no longer freeze `arthur run`". The only test that checks the event loop keeps running (`machine.test.ts`, "a spawn's step there and the sweep's fetch … do not end within 60 s") stalls only `arthur version`. The review criteria count a key-behaviour mutation the tests miss as a FAIL. The same probably holds for `removeThere` and `launchThere` (`machine-sync.ts:131`), but this mutate run did not reach them.
2. **`packages/core/src/job-machine.ts:24`: the push limit has no test.** Changing `PUSH_SECONDS` from 600 to 601, or to 599, both survive. The limit and its message, `machine <name>: git push: timed out after 600 s`, are in `spawn.md`, but no test runs a push that hangs. Removing the limit would also go unnoticed. The ticket's Done means says every git-over-ssh call has a time limit, and the criteria count "limit moved by one" uncaught as a FAIL. A 600 s real-time test is impractical, so the limit needs a way to be shortened in a test, as `gitOver`'s `limitSeconds` parameter already allows.

## Notes
- (minor) packages/core/src/job-machine.ts:146: a time-out in `gitOver` carries no `cause` 255. The worker says "a step that hits a limit fails as an unreachable machine (`cause` 255)". That holds for the ssh steps, not for a fetch or a push. A timed-out fetch is reported as a failure of that one job, and the machine is not held as unreachable. That behaviour is sensible, but the claim is broader than what the code does.
- (minor) packages/core/src/jobs.ts:139: `jobs.ts` is not in the Scope's "In" list. The change only adds `await` at the callers of the functions that became async; the final message lists it.
- (risk) packages/core/src/job-machine.ts:94: when `gitOver` is killed at its limit, the ssh process git started keeps running. This is already F2 in `findings.md`.
- (minor) packages/core/src/machine-sync.ts:88: the guard against two sweeps ending the same job compares only `state` and `offline`. That is enough today, and the test that removes the guard by hand fails, as the worker reports.

## Checks (on 8e91ff75)
- `npm run check && npm test`, in one call with a 1800 s timeout: `tsc` passed, and the tests ran. The first run's grep did not catch the summary lines, so I ran `npm test` again: tests 1560, pass 1496, fail 0, skipped 64.
- `npm run mutate`: 25 mutants, 22 caught, 3 survived, 141 not run (`--max 25`). The survivors are `job-machine.ts:168` (hunk reverted to the base) and `job-machine.ts:24` (`PUSH_SECONDS` 600→601, 600→599).
- No file was edited, so nothing needed restoring.

FAIL