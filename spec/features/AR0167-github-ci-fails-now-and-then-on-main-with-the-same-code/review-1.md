# AR0167 - Review 1

- Job: 2026-10-19-review-ar0167-87dbc87d
- Branch: h/2026-10-19-ar0167-be6531bc
- Commit reviewed: a9697f44039370aa6e4c9a92ae36e380b7644a89
- Verdict: FAIL

## Final message

## Findings

**1. Done means #1 (ticket) unmet: no failing test named, no "how found" evidence, anywhere in the deliverable.** All five commits (`a9697f4`, `7efd74f`, `ba75b20`, `d17fb7f`, `7df125d`) have empty bodies — `git log` shows only the subject line, no body text. `findings.md`'s one entry (F1) documents an unrelated, out-of-scope, `open` issue (resources test assumes ≥2 cores), not the four fixes actually in this range. The ticket's first Done-means bullet is: *"The failing test or tests are named, with how they were found: the suite run many times under a load..."* — this is not satisfied for any of the four fixes that were applied. Code comments explain the race mechanism (useful), but none state which test(s) were observed failing, how many times, or under what load, as the ticket requires.

**2. The explicit follow-up instruction was not carried out.** The coordinator told the worker: *"run the stress run you set up... to the end, report fails before and after with the test names, run npm test and npm run check, write the final message."* The worker's final message is: *"Meanwhile, the findings entry for the core-count assumption seen in the sweep."* — a single fragment that reports none of: before/after fail counts, test names, `npm test` result, `npm run check` result. This is a half-delivered task, not a completed report.

**3. Done means #3 ("the same stress run passes 30 times in a row... where it failed before") is undocumented** — not claimed, not evidenced, not attempted to completion in the branch.

Findings 1–3 are one root cause: the worker ran out of budget mid-report and the branch was left without the traceability the ticket explicitly demands as acceptance criteria, even though (per my own verification below) the code changes themselves are sound.

## Notes (not blocking)

- The four fixes are technically correct and match the styleguide's async-test rule (wait for the actual state; no retry wrapper; no skip):
  - `7df125d` (job-state.test.ts): adds `await until("job-ended", ...)` before asserting `ends()`, matching the file's existing wait idiom (used 6+ times already). I reproduced the exact pre-fix flake: extracting the base commit and stress-running `job-state.test.ts` 3-way parallel under `taskset -c 0,1`, I got 2 failures (of 21 completed iterations) in exactly this test (`a block with stop stops the run and holds the job blocked on the user once it ended...`), with the identical `ends()` empty-array symptom. The fix is real and correctly targeted.
  - `d17fb7f` (start-notice.test.ts): replaces pid-from-file + `alive()` with `ps`-based `running(folder)` to detect the killed probe, avoiding the race where the process is killed before it notes its own pid. Sequencing is race-free: the check happens before the second probe starts, so no ambiguity about which process `ps` sees.
  - `ba75b20` (fake-agent.ts + restart.test.ts): write-whole-then-`linkSync` pattern makes each noted file atomic from a reader's view (never empty on first read) — correct application of the styleguide's "write to a temp name, then atomic rename/link" rule; `EEXIST` fallback to append correctly handles concurrent first-writers without losing data.
  - `a9697f4` (job-state.ts `field()`): fixes a genuine TOCTOU (`existsSync` then `readFileSync`) in core — not test-only code, and not masking a bug: it catches `ENOENT` only and rethrows anything else, so legitimate errors still propagate. Mutation check: reverting to the old `existsSync`-guarded version, `packages/core/test/job-state.test.ts` still passes 16/16 deterministically — expected, since this is an inherent race only caught under load, consistent with the ticket's own "stress run" verification methodology rather than a unit test.
- `test/structure.test.ts` budget bumps (core +4, core/testing +4) match the actual diff size and are self-verifying: the structure test passed in all stress runs.

## Checks run

- `npm ci` in the review worktree: succeeds (`added 11 packages`, exit 0).
- `npm run check`: passes (`tsc`, no output/errors).
- `npm test` × 3 in parallel, each `taskset -c 0,1`, on the after-fix tree (`a9697f4`): all three runs report `tests 548 / pass 548 / fail 0 / cancelled 0 / skipped 0`.
- Reproduction on the pre-fix tree (`f113b196`, extracted via `git archive`, own `node_modules` copy): `packages/session/test/start-notice.test.ts packages/session/test/restart.test.ts packages/core/test/job-state.test.ts`, 3-way parallel under `taskset -c 0,1`, repeated; got 2/21-completed-iteration failures, both the exact test `7df125d` fixes (`a block with stop stops the run...`, `job-state.test.ts:213`), with the predicted empty-`ends()` symptom.
- Mutation test: reverted `job-state.ts` `field()` to the pre-fix `existsSync`/`readFileSync` form, ran `packages/core/test/job-state.test.ts` alone — 16/16 pass (confirms no deterministic unit coverage exists for this race, which is expected for this bug class and not itself a defect).

The code changes are sound and I independently reproduced the bug one of them fixes, but the branch fails the ticket's own first acceptance criterion (name the failing test(s) and how they were found) and ignores the explicit follow-up instruction to report before/after fails and run the checks in the final message. That is not mergeable as a closed-out CI-flake ticket.

FAIL
