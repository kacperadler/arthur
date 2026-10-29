# AR0541 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A job's agent still gets omp's named services and `proc://` writes, which need the broker the sandbox closes

- Kind: fix
- Found by: 2026-10-29-worker-8705208f (worker), 2026-10-29
- Where: `packages/core/src/job-omp.yml`
- What: inside this job, `write proc://bg_3/kill` failed with `Failed to start daemon broker at ~/.omp/run/daemons/<hash>/broker.sock after 10s: connect EACCES ...`: the sandbox opens no Unix stream socket (spawn.md, "The sandbox"). omp's bash `name` parameter (a supervised service) runs through the same launch broker, so a job's call of it can only fail after a 10 s wait [INFERENCE: not run]. The worker role forbids a process left running anyway.
- Suggestion: add `launch: { enabled: false }` to `job-omp.yml`, so the bash tool offers no `name`, `ready` or `env` to a job, with the assertion beside the two of AR0541 in `wrapper.test.ts`; first confirm with a real `omp -p --config` run that the parameters are gone. Leaves the coordinator's session alone.
- Status: open

## F2. The install-timeout test of limits.test.ts times out under load

- Kind: test
- Found by: 2026-10-29-worker-8705208f (worker), 2026-10-29
- Where: `packages/core/test/limits.test.ts:160`
- What: in a full `npm test` while two other worktrees ran theirs, `a timeout during the install a prepare asked for stops it, ...` failed with `Error: timed out waiting for the install's process` after 21.8 s; the same file alone passed 18 of 18 (`node --import @arthur/core/testing --test packages/core/test/limits.test.ts`). The change of AR0541 does not touch the install's path.
- Suggestion: find what the 20 s `until` waits for there and why it is slow under load (the sandbox's setup for the install, a `ps` scan); raise that wait or make it wait for the state it asserts.
- Status: open
