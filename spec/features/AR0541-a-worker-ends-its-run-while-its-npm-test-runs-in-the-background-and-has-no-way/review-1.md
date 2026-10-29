# AR0541 - Review 1

- Job: 2026-10-29-review-7ddf86ba
- Branch: arthur/2026-10-29-worker-8705208f
- Commit reviewed: 0b3a03028b9626ca7a8d4661499f229bf513fcc0
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/src/job-omp.yml:3-7` and `packages/core/src/wrapper.ts:79`: the Done means is still not met for the full `npm test`.** With background off, omp keeps a bash call in the call until its timeout. That timeout defaults to 300 s whenever the agent passes none. The omp 18.3.0 binary shows `TOOL_TIMEOUTS.bash = { default: 300, min: 1, max: 3600 }`, and `clampTimeout` applies `t ?? o.default`.
   - I confirmed the default with a real run: `omp -p --mode json --tools bash --config packages/core/src/job-omp.yml --config <cap tools.maxTimeout: 3>`, with the call args `{"command":"sleep 6; echo finished-ok"}` and no `timeout`. It returned `[Command timed out after 3 seconds] … Timeout clamped to 3s (requested 300s; …)`. So the default request is 300 s, and the command is killed at its deadline, not moved to the background.
   - In this worktree the full `npm test` took 577.5 s and 561.3 s (`duration_ms`). That was with two runs side by side, which matches the ticket's evidence of several workers at once.
   - So a worker that runs `npm test` the way the four named workers did now gets `Command timed out after 300 seconds` and no test result, unless it happens to pass a `timeout`. The branch swaps "result arrives after the run ends" for "the suite is killed at 300 s".
   - The ticket's Scope allows the worker role file. A line there telling the worker to run the checks with a bash `timeout` big enough for the suite (as the owner's own instruction for this review does with 1800 s), plus a fake-agent test that the text reaches the prompt, would close this. No omp setting changes the 300 s default; `tools.maxTimeout` is only a ceiling.
   - The worker only checked a 6 s `sleep`, which never comes near the deadline.

2. **`packages/core/docs/commands/spawn.md:76`: the doc overstates the fix.** It says each bash call, "`npm test` included, runs in the call until it ends or reaches its timeout, and the agent gets its result before its run ends". Because of finding 1, that is false for a suite longer than the 300 s default. A reader is told the problem is solved when it isn't.

## Notes (not blocking)
- The setting keys are real omp 18.3.0 settings (`bash.autoBackground.enabled`, `async.enabled`, both `default: true` in the binary's schema). `--config` can be given more than once and adds an overlay ("Load an extra config.yml-style overlay for this run (repeatable)").
- The change in `machine.test.ts` (checking for no `mcp.yml` instead of no `--config`) keeps what the test meant to check.
- F1 in `findings.md` matches what I saw: reading `proc://bg_2` from this job failed with `connect EACCES …/broker.sock`. My own first `npm test` call was moved to the background (`bg_2`, then `bg_3` for a later `sleep 120`), which is the ticket's symptom in this reviewer session.
- `wrapper.ts` is exactly 200 lines: at the limit, not over it.

## Checks run
- `npm ci`: added 24 packages, OK.
- `npm run check && npm test`, foreground with a 1800 s timeout: omp moved it to the background as `bg_2`. Its result came back later: `tsc` clean, `tests 1267, pass 1205, fail 0, skipped 62`, `duration_ms 577538`.
- Rerun with output to `.review-test.log` in this worktree, polled with short sleeps: `tests 1267, pass 1205, fail 0, skipped 62`, `duration_ms 561264`, `EXIT=0`. The log file is deleted. The worker's `limits.test.ts` failure did not happen in either run.
- Mutations on the test named "a finished worker" in `wrapper.test.ts`, each restored with `git checkout --` (`git status` clean afterwards):
  - Removing `--config <job-omp.yml>` from `wrapper.ts`: fail 1.
  - Deleting the `async:` block: fail 1.
  - `autoBackground.enabled: true`: fail 1.
- Real omp 18.3.0 smoke run with the job settings, a 3 s timeout cap and no `timeout` argument: the call stayed in the call and was killed at its timeout, `requested 300s`. The temporary `.tmp-review/` folder is removed.

FAIL