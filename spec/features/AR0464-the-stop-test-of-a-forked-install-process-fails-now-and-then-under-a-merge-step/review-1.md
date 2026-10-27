# AR0464 - Review 1

- Job: 2026-10-27-review-2e8b9e13
- Branch: arthur/2026-10-27-worker-296532a2
- Commit reviewed: 336f17cd83385d42ea0c2accf152806aca05e9a0
- Verdict: PASS

## Final message

**Findings:** none that block the merge.

The change in `packages/core/test/job-control.test.ts:124-141` addresses the cause the worker inferred, and it does not hide a stop that fails.

- **The cause.** The old line 138 checked `alive(forked)` once, right after the stop. `alive` (lines 67-74) uses `process.kill(pid, 0)`, which still answers "alive" for a zombie. The wrapper does not wait for the stop after an install. `halt` starts `stopGroup` into `stopping` (`wrapper.ts:104`), but only `play` waits for it (`:145`). When the stop comes during the install, line 148 skips `play` and the job ends without that wait. So the job can reach `ended: stopped` before the killed orphan has been reaped. A single check can lose that race; the bounded `until(... !alive(forked))` cannot.
- **Why a real failure still shows.** The SIGTERM is sent at once inside `halt`: `stopGroup`'s code before its first `await` calls `signal(-group, "SIGTERM")`. Only the reaping is waited for. The change from `sleep 3` to `sleep 300` matters: the forked process now outlives the 20 s bound, so it can only end by the stop. A stop that never reaches it fails the test with a timeout instead of passing when the sleep ends on its own. The bound is 20 s and the stop's grace before SIGKILL is 5 s, so a stop that needs its SIGKILL fallback still passes. That is correct stop behaviour, not a hidden failure.
- **Mutations.** Both mutations below were caught, so the wait does not mask a broken stop.
- **Scope.** The stop itself is unchanged, as the ticket's Scope requires. The wrapper race is written up as F1 in `findings.md`, not fixed on this branch, and that matches the Out clause. The diff adds `findings.md` next to the one test; that follows the findings convention.

**Notes (not blocking):**
- If this test fails before its last line, the `sleep 300` is left running for up to 5 minutes. The old `sleep 3` cleaned itself up. It uses no name a production resource uses, but a `t.after` that kills `forked` would remove it.
- F1 (`wrapper.ts:145`/`:148`): the job's `ended` state can come before the install group's stop is over. It is open and the merge will settle it. It is a real gap in the stop, not a test-only issue.
- Done means asks for 20 runs in a row both on the host and in a merge step. Your host results cover the host (20 of 20). Nobody here has run 20 in a merge step, me included.

**Checks I ran in this checkout:**
- `npm run check` (tsc): no errors.
- `node --test packages/core/test/job-control.test.ts`: 30 tests, 28 pass, 0 fail, 2 skipped. The 2 skipped need a systemd user manager, and `systemctl --user show-environment` fails here (exit 1).
- **Mutation 1:** in `wrapper.ts:104`, the stop only acts while `playing` (`if (playing && child?.pid !== undefined)`). The test failed after 22.7 s with "timed out waiting for the end of what the install left". Restored with `git checkout`, and the leftover `sleep 300` killed.
- **Mutation 2:** in `job-stop.ts`, SIGTERM goes to the leader's pid instead of the group (`signal(-group, "SIGTERM")` → `signal(group, "SIGTERM")`). Failed after 23.0 s with the same timeout. Restored with `git checkout` and the leftover sleep killed; `git status` is clean.
- I did not run the full suite or 20 runs in a row, as you asked; your host results stand for those.

PASS