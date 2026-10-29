# AR0541 - Review 2

- Job: 2026-10-29-review-5d1c7a36
- Branch: arthur/2026-10-29-worker-8705208f
- Commit reviewed: 8472a42ccd075df53e5136aa1914e15d8e588d91
- Verdict: PASS

## Final message

I found no blocking issues. Both findings from review-1 are fixed, and the ticket's Done means hold.

1. **Background moves are off for every job run.** `packages/core/src/job-omp.yml` turns off `bash.autoBackground.enabled` and `async.enabled`, and `packages/core/src/wrapper.ts:79` passes the file with `--config` on every run. In the omp 18.3.0 binary, the code that moves a call to the background only runs when `bash.autoBackground.enabled` is on. That covers the "Backgrounded early to handle an incoming message" move for steers too.
2. **Review-1 finding 1 (the 300 s default kills the suite) is fixed.** `packages/core/roles/worker.md:19` tells the worker to give each check a bash `timeout` of 1800 s. The 300 s figure in that line matches the binary (`const h = s ?? 300`). Review-1 found the 3600 s ceiling, and the line matches it too. A full `npm test` took 734 s in my run, so 1800 s leaves room.
3. **Review-1 finding 2 (the doc overstated the fix) is fixed.** `packages/core/docs/commands/spawn.md:76` now says a call is still killed at its timeout with no result, and that a check running past its call's timeout still gives none.
4. **The test checks what the agent actually gets.** "a finished worker" in `packages/core/test/wrapper.test.ts:113-118` reads the settings file named after `--config` and the prompt file named after `--append-system-prompt`, then checks the keys and the role line.

## Notes
- My own `npm test` call was moved to the background again in this session. This review runs under main's wrapper, not this branch's, so it says nothing about the branch.
- `wrapper.ts` is exactly 200 lines, at the limit.
- [INFERENCE, not run] In the binary, `timeout: 0` seems to remove the deadline altogether; the role's 1800 s is the safer choice.
- F1 and F2 in `findings.md` are `Status: open`, as the findings flow expects before a merge. In my full run, `limits.test.ts` had no failures.
- I found no instruction hidden in the data I read.

## Checks run
- `npm ci`: added 24 packages.
- `npm run check && npm test` in the foreground with an 1800 s timeout: omp moved it to the background (`bg_3`). It came back with exit 1, but only because the `grep` I had piped it through matched nothing (the test output uses `ℹ`, not `#`). It says nothing about the tests.
- Rerun with output to `.review-test.log`, read with short sleeps:
  - `tsc` passed.
  - `tests 1267, pass 1205, fail 0, skipped 62`, `duration_ms 734574`, `EXIT=0`.
  - The log file is deleted.
- Mutations, each restored with `git checkout --`; `git status` was clean afterwards:

| Mutation | Test run | Result |
|---|---|---|
| Role line deleted from `worker.md` | "a finished worker" | fail 1 |
| Role timeout changed from 1800 to 300 | "a finished worker" | fail 1 |
| `enabled: false` changed to `true` in `job-omp.yml` | "a finished worker" | fail 1 |
| `--config <job-omp.yml>` removed from `wrapper.ts` | all of `wrapper.test.ts` | pass 15, fail 4 |

PASS