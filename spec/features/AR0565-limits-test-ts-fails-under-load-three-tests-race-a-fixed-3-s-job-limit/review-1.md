# AR0565 - Review 1

- Job: 2026-10-30-review-f7ebb40d
- Branch: arthur/2026-10-30-worker-42aeee73
- Commit reviewed: 27e09c02896321d3514457ba0dabd4480fda4919
- Verdict: PASS

## Final message

No blocking findings. The branch fixes all three timeout tests in `packages/core/test/limits.test.ts`, which is the only file it touches, as the ticket's scope allows.

- **The wait ends on either event:** `before` (`limits.test.ts:65-75`) waits for whichever comes first, the state the test expects or the job's `job-ended` event. It reads the end before the state, so a state seen once the job has ended did happen before the end. If the job ended first, it asserts the reason starts with `limit: time: the job ran past its timeout of <n> minutes`.
- **Retry with a longer limit:** `timed` (`:58-61`) reruns a lost race with a 3, 6, 12 and then 24 s limit, each attempt in fresh folders, and fails after that. The retry cannot hide a broken limit:
  - With no limit, the job never ends, so the end wait times out.
  - With a limit that fires at once, every attempt ends first, so the test fails on the 24 s ceiling.
  - Each reason is checked against its prefix.
- **Pacing in test 3:** its fake agent counts from the mtime of the job's `pid` file. The wrapper saves that file just before it starts the time limit (`wrapper.ts:109,115`), so counting from it is sound.
- **Ceilings:** the 24 s ceiling and the 60 s `until` fit together: the 24 s limit plus the 5 s grace stays under 60 s. The `npm test` script sets no per-test timeout, so a slow attempt is not cut short. With the start slowed by 20 s, each test took about 46 to 51 s.

## Notes (non-blocking)
- The commit scope is `core`, not the ticket id `AR0565` (`test(core): …`). The worker says the commit hook refused its first subject.
- Raising `until` to 60 s applies to every test in the file, so a hung test now takes 60 s to fail instead of 20 s. That is a cost only when something breaks.
- Test 3's fake agent uses GNU `date -r … +%s%3N`. If that fails, the agent spends at once, which still works.

## Checks I ran
- **Full suite:** `npm ci` then `npm run check` and `npm test` in one call: install OK, tsc clean, tests 1309, pass 1247, fail 0, skipped 62 (250 s). This matches the worker's numbers.
- **`limits.test.ts` alone, unchanged:** 18 pass, 0 fail; the three timed tests took 3.2, 8.2 and 6.2 s.
- **Mutations in `wrapper.ts`**, each restored with `git checkout`, running only the three timed tests:
  - **No time limit** (`deadline(0, …)`): all three fail. Tests 1 and 2 time out waiting for `job-ended` (60.5 s); test 3 fails with `ended 10415 ms after the stop`.
  - **The install is never stopped** (`… && playing` added at line 105): test 2 fails with `timed out waiting for job-ended`.
  - **A time limit during the budget stop no longer prevents the resume** (`final ||= which === "stop"` at line 99): test 3 fails with `ended 10399 ms after the stop`.
  - **The limit fires at once** (`deadline(0.0001, …)`): all three fail with `each time limit up to 24 s ended the job before the state the test awaits`.
- **Job start slowed by 4 s:** I made the sandbox run `sleep 4; exec "$@"` first (in `job-sandbox.ts`, restored since).
  - The branch's file passed all three (9.4, 14.4 and 12.7 s).
  - The base commit's file failed all three, with `timed out waiting for the tool's process`, `the install's process` and `the stop at the budget`.
  - This reproduces the worker's claim.
- **Start slowed by 20 s:** the branch's file passed all three (45.8, 50.9 and 48.8 s).
- **Cleanup:** I ran every mutation and slowed run under my own `TMPDIR`. Two mutation runs left their own wrapper and install loop running. I killed them by PID (2452931, 2452940, 2456454, 2456464) and stopped nothing else. Then I removed my temp folder and confirmed the worktree is clean.

PASS