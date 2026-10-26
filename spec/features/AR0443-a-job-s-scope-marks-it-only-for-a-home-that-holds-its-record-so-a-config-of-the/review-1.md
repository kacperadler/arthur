# AR0443 - Review 1

- Job: 2026-10-26-review-cd45bf20
- Branch: arthur/2026-10-26-worker-1bf07670
- Commit reviewed: fbead502f9adb568f060abf4c96fb3f0cee4acd2
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/src/job-sandbox.ts:37-45`: the read walk breaks three core tests, so `npm test` fails.** Each failure passes on the base tree (`git archive 0e5ab024`) in the same environment. It also fails on a copy of `fbead502` made outside the worktree, so the branch causes it.
   - **`packages/core/test/job-control.test.ts:621`** ("the arthur binary stops, steers and continues a job…") fails every time, 3 runs out of 3. The check `starts(agent).length` gives `0` where the test expects `1`.
     - The job log I captured shows why. The agent line is stamped `14:18:46.170` and the `sandbox: … reads every file but /tmp/arthur-test-…/arthur/.env` line `46.564`. So the probe alone took about 0.4 s, and `arthur stop` (`46.567`) arrived before the fake agent recorded its start.
   - **`packages/core/test/limits.test.ts:135`** ("a timeout during a long tool call…") fails with `timed out waiting for the tool's process`.
   - **`packages/core/test/limits.test.ts`** ("an agent that ignores SIGTERM at its limit gets SIGKILL…") fails with `timed out waiting for the stop at the budget`.
   - Both limits tests use `timeoutMinutes: 0.01`, which is 0.6 s. The probe plus the start now cost more than that, because the test kit's env file lies under `/tmp` and the sandbox grants a read rule on every entry there, twice.
   - The worker logged this cost as perf finding F1 and never ran the full suite, which the plan's "How to test" requires ("run both from the worker's own job… The full suite run inside the worker's job is the check"). The ticket's Done means requires `npm test` to pass.
   - The fix has to keep the walk, which is what hides the file. Possible routes: have the probe skip the walk (it only looks for the agent), or have the test kit put its env file below a parent folder with few entries, as F1 suggests. Either way, all three tests must pass from inside a job.

## Notes (not blocking)

- **The security goal holds.** The new end-to-end test covers the attack: reading by path, through a symlink and through a hard link fails, and an own config and home with `ARTHUR_JOB` cleared gets `cannot be read (EACCES)`. The control run outside the sandbox prints the token.
- **I found no bypass:**
  - The walk skips symlinks.
  - A folder it cannot list grants nothing, so reads fail closed.
  - A missing path part made later stays hidden.
  - `/proc/<pid>/fd` and remounting are already closed by the domain.
- `config-check.ts:24` still calls `checkEnv` without `inJob`. That is fine as long as `arthur config` stays a command a job cannot run.
- The new budget, core 6267, is confirmed by the owner (AR-D61, AR-D63).
- Unrelated to the range: this review job's own sandbox refuses omp's broker socket (`connect EACCES …/broker.sock`). That stopped me from reading the status of background runs.

## Checks

- `npm ci`: ok. `npm run check` (tsc): exit 0.
- Full suite, run in the foreground batch by batch inside this job's sandbox:

| Batch | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| core: sandbox, host, env, config-check, inside-job | 58 | 54 | 0 | 4 (Unix socket refused by this job's sandbox) |
| core: board, cli, clock, commands, config, doctor, env-guard, events, git-config | 110 | 110 | 0 | 0 |
| core: job-control, job-records, job-state | 66 | 63 | **1** | 2 |
| core: jobs, limits, lock | 42 | 40 | **2** | 0 |
| core: machine, model, parts, roles | 63 | 62 | 0 | 1 |
| core: run, runner, scope, setup, spawn, testing, worktree-guard, wrapper | 109 | 96 | 0 | 13 |
| orchestration | 170 | 133 | 0 | 37 |
| commit-rules | 13 | 13 | 0 | 0 |
| delivery | 60 | 59 | 0 | 1 |
| develop | 37 | 37 | 0 | 0 |
| findings | 14 | 14 | 0 | 0 |
| github | 23 | 23 | 0 | 0 |
| machines | 24 | 24 | 0 | 0 |
| manage | 47 | 47 | 0 | 0 |
| models | 18 | 18 | 0 | 0 |
| nvm | 12 | 12 | 0 | 0 |
| projects | 46 | 46 | 0 | 0 |
| resources | 36 | 34 | 0 | 2 |
| schedule | 23 | 23 | 0 | 0 |
| session | 55 | 55 | 0 | 0 |
| telegram | 38 | 38 | 0 | 0 |
| uptime | 22 | 22 | 0 | 0 |
| youtrack | 37 | 37 | 0 | 0 |
| `test/*.test.ts` (structure test included) | 49 | 49 | 0 | 0 |

- **Base against branch on the three failing tests:** the base tree passes all three (1/1 and 4/4). Copies of the branch fail them (0/1 and 2/4).
- **Mutations:** each was caught by its tests, then restored with `git checkout`; `git status` is clean.
  - Dropping `- skip` from the walk: both new sandbox tests fail.
  - `[]` instead of `hidden(folder)` in `wrapper.ts`: the end-to-end test fails.
  - Dropping the `requires` skip in `host.ts`: the in-job host test fails.
  - Reading the env file inside a job in `env.ts`: the in-job host test fails.
- The throwaway copies under `/tmp` are removed.

FAIL