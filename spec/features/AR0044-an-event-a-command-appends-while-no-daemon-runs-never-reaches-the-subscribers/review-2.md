# AR0044 - Review 2

- Job: 2026-10-16-review-ar0044-events-rep-cb888135
- Branch: h/2026-10-16-ar0044-events-replay-aft-8791d5a8
- Commit reviewed: bf58a1b1016ec83b6582e1a0f1d875c8f60bf2c3
- Verdict: PASS

## Final message

The new work fixes the earlier finding. An event a plugin emits in `setup` is no longer delivered again after a restart, and the change stays within the ticket's scope.

**Findings:** none that block the merge.

**What changed in the new range** (`fa7c67e..bf58a1b`, `events.ts:90-94`):
- `follow()` now replays at once with `tick()`. It then writes `read.next - 1` to `events.delivered`.
- That number covers the early emits `follow()` skipped as already delivered, so the next session's replay no longer includes them.
- A first start that delivers nothing also keeps the number, so events appended between that start and the next one are no longer lost.

**Tests:**
- The new test "own events from before the follow, and the log a first start skips…" runs the reproduction from the earlier review: first start, emit before follow, restart. It asserts that the kept number is `1` and then `3`, and that a further restart delivers nothing.
- The two existing tests were updated for the earlier replay. In `run.test.ts` the real-process restart test now expects the replayed events before `start orchestration`.

**Notes:**
- The replay now runs before any plugin's `start`, not on the first 500 ms check. The worker flagged this and documented it in `docs/commands/run.md`. It is a behaviour shift the owner should accept. It fits the ticket's "start by delivering every event after that number" and the Decisions.
- `findings.md` F1 and F2 from the earlier round are still open as follow-ups.
- Line counts: `events.ts` 137, `event-log.ts` 116, `run.ts` 77, all under the 200-line limit.

**Checks I ran in the worktree:**
- `npm ci` completed with no errors.
- `npm run check` (`tsc`) passes.
- `npm test` passes: 163 of 163, 0 fail.
- Mutation 1: I deleted `keep(kept, read.next - 1)`. The new test fails, so the mutation is caught.
- Mutation 2: I disabled the `tick()` in `follow()`. Three tests fail: the "bus that follows again" test, the new test, and the `run.test.ts` restart test. The mutation is caught.
- I restored the working tree after each mutation, and `git status` is clean.

PASS
