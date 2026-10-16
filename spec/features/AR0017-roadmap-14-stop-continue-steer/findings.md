# AR0017 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `arthur continue` starts an agent without the plugins' `beforeSpawn` checks

- Kind: risk
- Found by: 2026-10-16-ar0017-stop-continue-ste-6a96b243 (worker), 2026-10-16
- Where: `packages/core/src/job-control.ts` (`continueJob`)
- What: a continued job runs an agent again, but only a spawn goes through `beforeSpawn`; a check such as orchestration's `maxAgents` (roadmap entry 23) does not see a continue, so continuing ended jobs can run more agents than the cap. [INFERENCE: no plugin registers such a check yet.]
- Suggestion: decide whether a continue counts as a spawn for the plugins' checks, and if so run the `beforeSpawn` checks (with the record's kind, project and tickets) before `launch` in `continueJob`.
- Status: open

## F2. A process that holds the agent's stdout open keeps the wrapper from ending the job

- Kind: risk
- Found by: 2026-10-16-ar0017-stop-continue-ste-6a96b243 (worker), 2026-10-16
- Where: `packages/core/src/wrapper.ts` (`play`, which waits for the agent's `close`)
- What: the wrapper reads the agent until its stdout and stderr close, not until it exits. A process the agent started with those pipes inherited keeps them open after the agent exits: the test "a stop that comes once the agent exited on its own leaves the job's own ending" (`job-control.test.ts`) relies on a `sleep 2 &` doing so for two seconds. A daemon that never closes them leaves the job `running` forever, since `endScope`, which would kill it, runs only after `close`. [INFERENCE: omp's bash tool gives the commands it runs pipes of its own, so only a process omp itself starts this way is affected.]
- Suggestion: once the agent has exited (`exit`), give the pipes a short time, then end the scope and stop reading, so a held pipe cannot hold the end.
- Status: open

## F3. Two `arthur continue` at once can start two wrappers on one record where the job runs bare

- Kind: risk
- Found by: 2026-10-16-ar0017-stop-continue-ste-6a96b243 (worker), 2026-10-16
- Where: `packages/core/src/job-control.ts` (`continueJob`)
- What: `continueJob` checks that the state is final, then starts the wrapper, which writes `running` only when it runs. Two continues in that window both start a wrapper; in a scope the second `systemd-run` fails on the scope's name (and, as in AR0056, nothing reports it), but a job that runs bare gets two agents in one worktree, both writing the record. `arthur continue` also prints `continued` before the wrapper is known to have started.
- Suggestion: take the record for the continue first (an exclusive create of a file in the record, removed by the wrapper at its start, or the core's lock), and report a wrapper that did not start.
- Status: open
