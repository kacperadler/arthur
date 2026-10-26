# AR0443 - Review 3

- Job: 2026-10-26-review-ea5a1400
- Branch: arthur/2026-10-26-worker-1bf07670
- Commit reviewed: 231b20a8057e2ee2bebb973afa93ff6264540618
- Verdict: PASS

## Final message

No blocking findings. Since review 2, the branch has one new commit, `231b20a8`, and it changes only `packages/core/test/limits.test.ts`. That fixes review 2's finding: the SIGTERM test no longer fails because of the sandbox's start.

**What the change does:**
- **SIGTERM/grace test (`packages/core/test/limits.test.ts:196`):** the time limit goes from `0.005` to `0.05` minutes, which is 3 s.
  - The stop at the budget still comes first, right after the start.
  - The time limit then fires during the 5 s grace, so the test still checks "limit: time: reached as well", the SIGKILL after the grace, that the agent ended between 5 s and 10 s after the stop, and that it was not resumed.
  - 3 s is still well inside the grace, so the time limit really does fire there, as the test needs.
- **Timeout test (`packages/core/test/limits.test.ts:143`):** the time limit goes from `0.01` to `0.05` minutes, and the expected reason changes to match.
  - The test still checks that the time limit ends the job, that the `sleep 100` tool process is gone, that there was one start only (not resumed), and the log line.
  - If the timer were removed, the job would never end, so `ended` would time out and the test would fail.
- **Mutation:** I made `wrapper.ts:100` skip the "reached as well" note (`which === "budget"` changed to `which !== "nothing"`). The SIGTERM test fails on exactly that assertion (`/\] limit: time: reached as well\n/`), so it still catches the time limit firing during the grace. I restored the file with `git checkout`, and `git status --short` is empty.

**Notes (not blocking):**
- The worker's final message matches the diff: one file, two limits, two one-line comments.
- F1 (perf) in `findings.md` stays open. Each start still walks the temporary folder, about 0.25 s on this host. These tests now leave room for that, but the start itself is not cheaper.
- As you asked, I ran only the three test files below, not the whole suite. The full suite result is the coordinator's: 1172 tests, 1166 pass, 0 fail, 6 skipped.

**Checks run in my checkout (foreground):**
- `npm run check`: exit 0.
- `node --test packages/core/test/limits.test.ts`, run 1: 17 tests, 17 pass, 0 fail. The SIGTERM test took 5511 ms and the timeout test 3193 ms.
- `node --test packages/core/test/limits.test.ts`, run 2: 17 tests, 17 pass, 0 fail.
- `node --test packages/core/test/sandbox.test.ts`: 12 tests, 8 pass, 0 fail, 4 skipped. The 4 skips are the tests that need a Unix socket.
- Mutation run: `--test-name-pattern="ignores SIGTERM"` on `limits.test.ts`: 1 test, 0 pass, 1 fail, as expected.

PASS