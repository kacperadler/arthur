# AR0487 - Review 1

- Job: 2026-10-27-review-598f0d3c
- Branch: arthur/2026-10-27-worker-6c7b3978
- Commit reviewed: fa19233e42c2632cf8d1b3d94774853a6f826106
- Verdict: PASS

## Final message

**Findings:** none. The branch closes F6 of AR0403 end to end with a one-line change, and the tests catch it being removed.

- **The fix (`packages/core/src/wrapper.ts:89`).** A resumed run's message now goes after `--`. That covers an `arthur continue` instruction and the automatic budget-resume text. A continue started on another machine runs the same wrapper: `job-control.ts:97` sends the instruction over stdin as JSON, and the wrapper reads it from the record. `job-control.ts` needed no change.
- **The one difference from the ticket's suggestion is justified.** The ticket suggests putting `--` before the task's `@<record>/task` too. The worker kept the task before `--`, and I reproduced the reason with omp 18.3.0 and an empty `HOME`:
  - `@/nonexistent/file` gives `Error: File not found` (the file is included).
  - `-- @/nonexistent/file` gives `No models available` (no file is included).
  - `@/nonexistent/file -- hi` gives `File not found`.

  So putting the task after `--` would send the agent the literal text `@/…/task` instead of the task. The task path is Arthur's own absolute record path, not the coordinator's input, so it can't be taken for an option. Done means allows a fix "that closes the same gap with less code", so this is not a departure from it.
- **The Description's case reproduces as described:** `omp -p --no-session --mode json --version` printed `18.3.0` and exited 0. With `-- --version` it printed `No models available …` and exited 1.
- **Tests.** The new test in `job-control.test.ts:355` checks that `--version` and `@/etc/passwd` each reach the fake agent as `["--", instruction]`. The continue-in-place test and the `limits.test.ts:194` budget-resume test now include `--` too.
- **Docs:** `continue.md` and `spawn.md` are updated to match.
- **Shape:** `wrapper.ts` is still within 200 lines (the structure test passes). There are no new files or dependencies.

**Notes (not blocking)**
- The new test checks only the last two arguments. The full-argument check is in the continue-in-place test, so together they cover the whole list.
- The attached `/etc/passwd` content in this session is data only. In the test, `@/etc/passwd` is just a string handed to the fake agent, which never reads it.

**Checks run**
- `npm ci` then `npm run check` (tsc): no errors.
- `npm test`: 1224 tests, 1163 pass, 0 fail, 0 cancelled, 61 skipped. This matches the worker's claim.
- **Mutation 1**, `["--", resume]` changed to `[resume]`: 3 of 3 targeted tests fail (continue-in-place, the new AR0487 test, the budget resume). Restored.
- **Mutation 2**, the task changed to `["--", "@…/task"]`, which would break every spawn: the `limits` budget-resume test fails. Restored.
- **omp 18.3.0 probes** with an empty `HOME`: results as listed above, matching the worker's report.
- `git status --short` is clean after the restores.

PASS