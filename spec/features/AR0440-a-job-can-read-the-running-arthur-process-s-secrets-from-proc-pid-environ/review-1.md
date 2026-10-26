# AR0440 - Review 1

- Job: 2026-10-26-review-87a54323
- Branch: arthur/2026-10-26-worker-8dba5348
- Commit reviewed: 997705f464f6765e2bcf31d33ecbb7fc4975d735
- Verdict: PASS

## Final message

I found no blocking issues. The branch does what the approved plan asked for (Option 1, the owner's answer to AR-D64): one new test and two doc edits, with no source file changed.

## Findings

None.

## Notes (not blocking)

- **New test** (`packages/core/test/sandbox.test.ts:224-253`): it matches the plan's Files section.
  - A runner child process is started with `ARTHUR_TEST_TOKEN=shell-t0ken` in its environment, runs the real `jobRunner`, and passes its pid on as `RUNNER_PID`.
  - The agent reads `/proc/$RUNNER_PID/environ`. The test checks that the output holds `Permission denied` and `refused` but not `shell-t0ken`, and that the job log has the `sandbox:` line.
  - As a control, the test reads the runner's environment itself and finds the token there.
  - If the agent never runs, the test fails, because the `read` file is missing.
  - The file is 253 lines, but the 200-line rule applies only to source files under `src/`, as `test/structure.test.ts:864` shows.
- **Doc claims check out live.** Inside this sandboxed review job, against the real `arthur run` (pid 3021873):
  - `/proc/<pid>/environ` gave `Permission denied`.
  - `/proc/<pid>/mem` gave `Permission denied`.
  - `/proc/<pid>/cmdline` could be read: `node …/arthur run`.
- **`docs/deploy.md:33`** gives "(macOS, no `python3`)" as the hosts where `/proc/<pid>/environ` is readable. macOS has no `/proc`, so the example is slightly off. The point still holds, and it repeats the list already used on line 35.
- **`findings.md` F1** follows the layout of other Arthur findings files, such as AR0401's. It leaves the separate-ticket question (AR-D65) open, as the plan's Open questions did. That is fine, since the owner has not answered AR-D65 yet.
- **Outside the range:** `spec/features/_template/findings.md` mentions `K0000` and `h merge`, which are not Arthur's names.

## Checks run

- `npm ci`: added 22 packages, no errors.
- `npm run check`: `tsc` finished with no errors.
- `node --test packages/core/test/sandbox.test.ts`: 10 tests, 6 passed, 0 failed, 4 skipped. The 4 skips are the Unix-socket tests, which can't run here because this review job itself runs in a sandbox. This matches the worker's claim. The new test passed in 363 ms.
- **Mutation 1:** I commented out the Landlock `restrict_self` call (`job-sandbox.ts:40`, syscall 446) and kept no_new_privs and seccomp. The new test failed: the agent's output held `ARTHUR_TEST_TOKEN=shell-t0ken`. I restored the file.
- **Mutation 2:** I made `sandboxed` return `[agent, [...argv]]` at once, so the agent ran bare. The new test failed on the `Permission denied` check. I restored the file, and `git status --short` was clean afterwards.
- The full `npm test` was not run, as you asked.

PASS