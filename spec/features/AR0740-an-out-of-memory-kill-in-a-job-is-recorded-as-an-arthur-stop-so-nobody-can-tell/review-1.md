# AR0740 - Review 1

- Job: 2026-11-25-review-e3d746c3
- Branch: arthur/2026-11-25-worker-ab0e1866
- Commit reviewed: 3bdf0972f3754d85c979ae28742d44f01a5d9c57
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0740 asks. An out-of-memory kill in a job's scope now ends the job `limit: memory: ...` instead of `stopped`, and the kernel's lines about the killed process go into its log.

- `packages/core/src/wrapper.ts:109`: when a SIGTERM arrives, the wrapper first calls `watching.check()`. Once the scope's `memory.events` counts a new `oom_kill`, the SIGTERM is taken as systemd's stop and goes to `halt("memory")`, not `halt("stop")`. `watching` is assigned at line 122 with no `await` between that line and the handler at 109, so a signal cannot reach the handler before `watching` exists.
- `packages/core/src/job-memory.ts:25-66`: every job with a scope is now watched, even one without caps. A kill that neither the job's own cap nor its ticket's slice counts is reported as a kill at a cap above the job. `end` adds the kernel's `oom-kill:` and `Killed process` lines from `journalctl -k`, or one line saying why there are none.
- Done means:
  - **Memory reason and log:** met, covered by a test with a fake scope and a fake `journalctl`, which runs inside a job.
  - **Allocation past a small cap:** the real test is skipped inside a job (F1). Per your message, the coordinator ran it outside a job and it passed; I did not run it.
  - **`arthur stop` still ends `stopped`:** its existing test is unchanged and still checked; the new test also checks that a SIGTERM with no kill still logs `arthur stop` and ends `stopped`.
  - **Help pages:** `spawn.md`, `stop.md` and `jobs.md` say how an out-of-memory kill ends a job, and no other doc still contradicts it.
  - **Mutate:** you said not to rerun it (complete on 3bdf0972: 94 mutants, 86 caught, 8 survived). The one survivor that changes behaviour is `detached: true`, which is ticket AR0741.
- **Size and budget:** the core's line budget goes from 7617 to 7649 in `test/structure.test.ts`, which belongs in the merge's outcome.md. `wrapper.ts` counts 219 lines both before and after this branch, so the branch did not move it into yellow.

## Notes
- (risk) packages/core/src/job-scope.ts:68: the worker saw a test's `wrapper.ts` and `fake-agent.ts` (from `/tmp/arthur-test-*`) still running after `npm run mutate` ended. It guessed the cause is the detached wrapper escaping mutate's process-group kill, but did not prove it, and no finding records this yet.
- (minor) packages/core/src/job-memory.ts:63: `end` reads `memory.events` again without a `try`. The read at line 62 has the same exposure, and the file exists for as long as the wrapper is inside its scope.
- (minor) packages/core/docs/commands/stop.md:14: an `arthur stop` sent by a person after a kill is counted as memory, not as their stop. The page says so; it is a deliberate trade-off.

## Checks (on 3bdf0972, in this checkout)
- `npm run check`: tsc passed with no errors.
- `npm test` (exit 0): 1945 tests, 1880 pass, 0 fail, 0 cancelled, 65 skipped. The structure test prints `packages/core/src/wrapper.ts: 219 lines, yellow (over 200)`.
- `node --import @arthur/core/testing --test packages/core/test/job-memory.test.ts packages/core/test/scope.test.ts`: 39 tests, 26 pass, 0 fail, 13 skipped because this job has no systemd user manager. The fake-scope SIGTERM test passed; the real allocation test was skipped.
- Mutation by hand: I changed `wrapper.ts:109` to `process.on("SIGTERM", () => halt("stop"))`, and `scope.test.ts` failed 1 of 14 (`once its scope counts an out-of-memory kill ...`). I put the file back with `git checkout -- packages/core/src/wrapper.ts`, and `git status --short` is empty.
- Measured line counts: `wrapper.ts` counts 219 at both the base (bc7d8002) and the tip.

PASS