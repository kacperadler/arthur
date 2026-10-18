# AR0136 - Review 1

- Job: 2026-10-18-review-ar0136-flaky-test-07a608e9
- Branch: h/2026-10-18-ar0136-flaky-test-6f928022
- Commit reviewed: 46d5009c536325da26edb315017040d7e0bf1ee9
- Verdict: PASS

## Final message

## Findings

None blocking.

## Notes

- `spec/features/AR0136.../ticket.md` gains a `Decisions` line attributed to "Coordinator" (commit `46d5009`), the first such line ever added within a worker's own range across this repo's tickets (every other `Coordinator:` decision I sampled was added outside the worker's branch). The task's own `Focus` section treats this line and its "24 parallel loaded runs" claim as established (`ticket Decisions`) and says one `npm test` run here is enough, so I did not treat the attribution as a fabrication; flagging only as a convention oddity, not a merge blocker.
- `packages/core/test/limits.test.ts`'s new regex capture (`line[1] ?? ""`) would silently feed `Date.parse("")` → `NaN` if the log line's bracketed capture were ever empty; not reachable given `new Date().toISOString()` always populates it, so not a real risk, just a slightly defensive-looking line.

## Checks run

- `npm ci` — installed, 8 packages, no errors.
- `npm run check` (`tsc`) — clean, no output/errors.
- `npm test` (full suite, single run, no induced load) — `423/423` pass, `0` fail, matches worker's claimed count exactly.
- Mutation check on F4 (`packages/core/test/job-records.test.ts`): reverted the two fixed-id lines back to `2026-10-16-worker-0000000a` / `...00000010`, ran the file 4× in parallel (`node --import @arthur/core/testing --test packages/core/test/job-records.test.ts`). Run 2 failed with `ENOENT ... jobs/2026-10-16-worker-0000000a/reason` on "the sweep keeps a working job whose wrapper runs before it wrote its pid..." — exact failure the finding describes. Restored the file (`git diff` on it was empty after restore), reran the same 4-parallel invocation with the fix: `4/4` runs `19 pass, 0 fail` each. Confirms the fix closes the reproduced race and the test would have caught the un-fixed version (mutation: revert to fixed ids → fails under parallel load).
- Cross-checked F1's cause against `packages/core/src/wrapper.ts:170-176` (confirmed `moveJob` — state write — precedes `bus.emit("core","job-ended", …)`), and F7's cause against `packages/core/src/events.ts:71-79` (confirmed `emit` appends to the log before delivering to its own subscribers) — both match the findings' stated causes.
- Cross-checked the SIGKILL grace ceiling (`GRACE_SECONDS + 5`) against `packages/core/src/job-control.ts:20` (`STOP_WAIT_SECONDS = GRACE_SECONDS + 10`) — margin as claimed, below the real give-up threshold.
- Cross-checked the inbox redelivery ceilings (`<19_000` for the third wait) against `packages/orchestration/src/inbox-extension.ts:42` (`pause = failed<2?0:5000*2**(failed-2)`) — `0, 0, 5000, 10000, 20000` sequence confirmed, ceiling sits below the next doubling with margin.
- `git status --short` in the worktree — clean, nothing left over from the mutation check.
- Confirmed diff touches only `packages/*/test/**` and the ticket's `spec/features/...` docs — no production `src/` file changed, matching the ticket's scope and the final message's claim.

PASS
