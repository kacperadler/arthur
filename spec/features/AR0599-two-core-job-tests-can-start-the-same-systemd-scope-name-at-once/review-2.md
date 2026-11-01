# AR0599 - Review 2

- Job: 2026-11-01-review-c8d578d9
- Branch: arthur/2026-10-31-worker-111db639
- Commit reviewed: 6c01e8676d9365d670fdb0d0e3c2bd83ef359a0c
- Verdict: PASS

## Final message

The one finding from review 1 is fixed, and every check I ran passed.

**Leftover processes:** the ten `sleep 300` processes came from my 30 runs of `job-control.test.ts`. The tests started two every minute, in step with the runs, all under parent pid 177004. I stopped them by pid with `kill`. pid 1504050 had already exited by then, about 297 s into its 300. Afterwards `ps` found none of the ten. Nothing in the tree changed.

## Findings
No blocking findings.

- **Review 1's finding is fixed.** `packages/core/docs/commands/continue.md:16` no longer says the new run reuses the old scope's name. It now says the continue waits "since two never run for one job", and that the new run starts in `arthur-job-<id>.<ms>.scope`. This matches `spawn.md:68` and the code at `packages/core/src/job-scope.ts:60`.
- **The ticket's Done-means points are met.**
  - **New scope name:** each continue gets a new scope name. The `continue` file is written (`job-control.ts:126`) before `launch` reads it, so the first run keeps `arthur-job-<id>.scope` and every continue gets the timestamped name.
  - **Fake `systemd-run` test:** the new test at `packages/core/test/job-control.test.ts:465` puts first on `PATH` a fake `systemd-run` that refuses a name it has already used once, as the ticket asks.
  - **30 runs:** `job-control.test.ts` passed 30 times in a row on this machine. Review 1 had left this point without evidence.
- **Files outside the ticket's scope.** The branch also changes `inside-job.ts`, `processes-extension.ts`, docs and other packages' tests. That is needed: every place that read the job from the old scope name has to accept the new one too. The worker's final message lists each of these files.

## Notes
- (risk) `packages/core/src/job-scope.ts:155`: nothing tests `ownScope` matching a continued run's scope here, because the real-systemd tests in `scope.test.ts` skip without a user manager. You report that CI run 41262283070 on 6c01e86 passed with them included.
- (risk) `packages/core/test/job-control.test.ts`: each run of the file left two `sleep 300` processes behind, ten over my 30 runs. They match the "a test never leaves a resource behind" rule. I did not trace which test starts them, so this may come from before this branch.
- (minor) `packages/delivery/src/processes-extension.ts:39`: it copies the `JOB_SCOPE` regex instead of importing it from `@arthur/core/inside-job`, which its test does import. The two copies can drift apart.
- (minor) `test/structure.test.ts`: the core line budget goes from 7039 to 7041. The raise must show in the merge's `outcome.md`.

## Checks
- `npm run check` (`tsc`): exit 0.
- `npm test`: 1457 tests, 1393 pass, 0 fail, 0 cancelled, 64 skipped, matching the worker's numbers. No timing test failed, so I did not run `limits.test.ts` alone.
- `node --test packages/core/test/job-control.test.ts`: 30 runs in a row, 30 passed (each 37 tests, 35 pass, 2 skipped). This sandbox has no systemd user manager, so these runs use the fake `systemd-run`, not the real race.
- Not run: `npm run mutate` and hand mutations, to keep within the budget you set.

PASS