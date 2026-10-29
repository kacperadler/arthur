# AR0481 - Review 1

- Job: 2026-10-29-review-1d5fa9ce
- Branch: arthur/2026-10-29-worker-00ef886c
- Commit reviewed: b8772232a4066ea0c04eebc47dde6ad256e5b90d
- Verdict: PASS

## Final message

I found no blocking findings. The fix does what AR0481 asks, in exactly the two files the ticket scopes.

**Findings**

None.

**Notes (not blocking)**

- `packages/core/src/wrapper.ts:123`: the change adds `.finally(() => stopping)` to the install's promise. `finally` waits for a promise its callback returns, and `stopping` is read when the install's `close` comes. So a stop or limit during the install now waits for `stopGroup`, including the SIGKILL after the grace. That happens before line 148 decides whether to start the agent, so the job is not ended early. With no stop, `stopping` is `Promise.resolve()`, so nothing changes. `job-stop.ts` is not touched, as the ticket says.
- `packages/core/test/job-control.test.ts:171`: the new test can flake in theory. `stopJob` has to land within the 2 s between the install's exit and its `close`; if it misses, the agent starts and the test fails. The AR0464 test at `:129` has the same window, so this follows the existing pattern. It passed 3 out of 3 runs on its own.
- The test waits with `until` for the forked process to die after `ended`. The log-order check is what proves the timing: the SIGKILL line comes before `ended: stopped`.
- Unrelated: a stray `sleep 300` (pid 1253045) had been running for 287 s, under `systemd --user`, cwd unreadable. I can't tell which run it came from. It started before my runs of the single test, and this branch's test kills its own forked process in `t.after`.

**Checks run**

- `npm ci`, `npm run check` (tsc) and `npm test`, run twice. The harness put the foreground run in the background; the second run wrote to a file in my worktree, which I deleted afterwards. Both gave 1268 tests: 1206 passed, 0 failed, 62 skipped, exit 0. This matches what the worker reported.
- Mutation: I removed `.finally(() => stopping)` from `wrapper.ts:123` and ran the new test alone. It fails: the log has `ended: stopped` with no SIGKILL line before it. So the test fails before the fix, as the ticket requires. I restored the file with `git checkout -- packages/core/src/wrapper.ts`, and `git status` is clean.
- After restoring, the new test passed on its own 3 times in a row. It runs here because this machine has no systemd user manager, so the job runs bare.
- Range: one commit, `fix(AR0481): …`, changing 2 files (+20/−1), both in the ticket's Scope.

PASS