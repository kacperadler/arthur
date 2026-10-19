# AR0145 - Review 1

- Job: 2026-10-19-review-ar0145-resources-e9b20ac1
- Branch: h/2026-10-19-ar0145-resources-batch-00d689f3
- Commit reviewed: 77d39b69e0d1fc5a35b3c735e575e1455247ff9e
- Verdict: PASS

## Final message

## Review: h/2026-10-19-ar0145-resources-batch-00d689f3 @ 77d39b6

### Findings
None that block merge.

### Notes (non-blocking)
- Instruction asked "one commit per ticket (scope its id)"; AR0145 and AR0150 each span two commits (fix + a follow-up test-only commit, both scoped to the same ticket id). Worker's final message explains both: `d5905d0` isolates the line-budget raise "so it can be dropped," and `77d39b6` fixes mock-timing jitter it diagnosed in its own new test. Reasonable, not a process violation that affects mergeability.
- AR0147 `findings.md` F1 (ticket slice has no `MemorySwapMax`) is correctly recorded as `open`, not silently dropped; the AR0147 test design works around it as stated.

### Verification performed (in this worktree, not the main checkout)
- Read all six tickets at `main` (`git show main:.../ticket.md`); AR0149's 2026-10-19 Decision explicitly removes it from this batch — matches worker's skip.
- Full diff read: `job-control.ts`, `job-record.ts`, `job-scope.ts`, `jobs.ts`, `remote-job.ts`, `job-memory.ts`, `wrapper.ts`, `machine-free.ts`, all test diffs, all docs diffs, `structure.test.ts` budget change, `findings.md`.
- `npm run check`: clean (tsc, 0.5s).
- `npm test`: 679/679 passed, 0 failed (4m16s), matching the worker's claim exactly.
- Mutation tests (throwaway edits, reverted with `git checkout --` after each):
  - Removed `|| feature !== ""` from the `uncapped()` condition (AR0146) → the new "job with only its ticket's caps runs bare" test fails (0 ≠ 1). Confirms the test actually exercises the fix.
  - Removed the `killsNow > kills` guard in `job-memory.ts`'s ticket-OOM detection (AR0147) → the "ticket's other job... runs on" test fails (`ended` ≠ `working`, i.e. the sibling job wrongly dies too). Confirms the test catches this exact failure mode.
  - Commented out the `capFields` record rewrite in `continueJob` (AR0145) → the "caps in force now, not those kept at spawn" test fails (`1s`/300M instead of `infinity`/1G).
  - Reverted `machine-free.ts` to the pre-fix (loadavg-based) version → new AR0150 test fails exactly as the worker describes ("actual 0, expected 3"), plus two more now-broken assertions elsewhere in the file (expected, since those were also relying on the old loadavg mock removed in this branch — correctly updated by the worker).
  - AR0171: confirmed the fix is purely `availableParallelism() >= 2 ? "1.500000s" : "1s"` in the test, matching the ticket's named options exactly ("take the expected quota as `min(1.5, availableParallelism())`").
- Ran the changed test files (`scope.test.ts`, `resources.test.ts`, `room.test.ts`, `machine.test.ts`) under `taskset -c 0` and `taskset -c 0,1` on this 7-core box: all pass both ways, confirming no 2-core assumption remains and the new 1-core-safe behavior holds.
- Verified the `os.cpus()` busy/idle math directly with throwaway Node scripts on this real 7-core machine: idle machine → ~0.06 busy cores of 7 (sane); a worker thread spinning ~1 core for 1.2s → ~1.14 busy cores measured (sane, confirms the aggregation across all `cpus()` entries is correct on real multi-core hardware, not just the single-fake-core test mocks).
- Checked the fake-ssh harness in `room.test.ts`: `ssh` is a local shell script placed first on `PATH`; even in "real" mode it `exec sh -c "$*"` locally, it never contacts a network host — confirms it cannot reach a real machine.
- Checked file line budgets: all touched `src/*.ts` files ≤ 200 lines (`jobs.ts` exactly 200, unchanged from before — single line edited kept the same length). Package budget raise (core 5448→5479, resources 458→467) matches exactly what the ticket's own Decision pre-approved and what `structure.test.ts` now encodes, with the required one-line comment recording the reason.
- Confirmed no plugin/core boundary violations: all changes are internal to `@arthur/core` or `@arthur/resources`'s own `src/`; `job-record.ts`'s new `capFields` only type-imports `Caps` from `job-scope.ts` within the same package.

All five built tickets (AR0145, AR0146, AR0147, AR0150, AR0171) meet their Done means with a test that demonstrably fails without the fix; AR0149 is legitimately out of scope per the ticket's own recorded decision; docs are updated consistently; checks and full test suite reproduce clean.

PASS
