# AR0373 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. An `arthur merge` an agent runs never gets a scope of its own

- Kind: security
- Found by: 2026-10-26-worker-9f5b347e (worker), 2026-10-26
- Where: `packages/delivery/src/merge-checks.ts` (`stepRunner`'s probe), `packages/core/docs/commands/spawn.md:116` (the sandbox makes no Unix socket)
- What: inside a job's sandbox `systemd-run --user` cannot reach the user manager's bus (`systemd-run --user --scope --quiet true` in this job printed `Failed to connect to bus: Permission denied`), so an `arthur merge` that the coordinator's agent runs takes the bare path, with its `uncapped:` line: its steps run in the coordinator's own scope, under that job's caps, and what they leave running lives until the coordinator's job ends, not until the step ends. [INFERENCE: the coordinator's agent runs in the same sandbox as this worker's; not run against a coordinator.]
- Suggestion: have the bare path inside a job kill what each step left in the job's own scope (the processes of `ownScope` started after the step, as `endScope` does), or run the steps through the host's service; out: opening the bus to the sandbox.
- Status: open
