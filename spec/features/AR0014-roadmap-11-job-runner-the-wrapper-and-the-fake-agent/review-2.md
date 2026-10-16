# AR0014 - Review 2

- Job: 2026-10-16-review-ar0014-wrapper-an-a3cd8397
- Branch: h/2026-10-16-ar0014-wrapper-and-fake-e707fea6
- Commit reviewed: d1b32cc3ce61e954a1d2f7a4bb1c8a32ab2df9c2
- Verdict: PASS

## Final message

Both earlier findings are fixed. I found no new blocking issues.

**Finding 1, process-group stop (`packages/core/src/wrapper.ts:83-93`):** `stopAgent` now sends SIGTERM to `-process.pid`, the job's process group. `launch` makes the wrapper the leader of that group, so the agent and every process it started are signalled. The wrapper first installs a no-op SIGTERM handler so it survives its own signal long enough to write its one log line. If the group kill throws (a wrapper started by hand leads no group), it falls back to `child.kill("SIGTERM")`. `spawn.md` documents this. The new test starts a real `sleep 100` from the agent script, deletes the record, and waits until both the wrapper and that `sleep` are gone. `pgrep` found no leftover `sleep 100` after the full run.

**Finding 2, racy wait (`wrapper.test.ts` "a finished worker…"):** the test now waits until all five record files (`tool-calls`, `state`, `cost`, `checks`, `activity`) hold their expected values, then asserts. It no longer reads `activity` after waiting on a different signal.

**Notes (non-blocking):**
- A process that leaves the group (for example through `setsid`) is not stopped. The worker names this limit in its message and in `spawn.md`.
- The group-kill try/catch is justified: a hand-started wrapper has no group, so the call throws.

**Checks I ran:**
- `npm ci`: succeeded (output suppressed).
- `npm run check`: passes with no errors.
- `npm test`: 187 of 187 pass.
- `wrapper.test.ts` alone, three more times: 12 of 12 each time.
- Mutation: removed the SIGTERM no-op handler. The test "a record deleted while the job runs: the agent is stopped, the wrapper ends with one line…" failed, so the tests catch it. I restored the file with `git checkout` and killed the orphaned `sleep`.
- I did not rerun the child-kill mutation (restoring `child.kill("SIGTERM")`) myself. The worker reports the new test catches it.
- The worktree is clean after the mutation.

PASS
