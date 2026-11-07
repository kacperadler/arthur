# AR0644 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The ticket's Decisions do not yet record the two API changes

- Kind: docs
- Found by: 2026-11-06-worker-926f0a0f (worker), 2026-11-06
- Where: `spec/features/AR0644-docker-w1-host-jobs-cleanup-a-hook-every-worktree-removal-runs-and-prune-awaited/ticket.md:37`
- What: `docs/plugin-api.md`'s first paragraph says an API change is a decision recorded in the ticket that makes it, and the plan's open question asks for each in its ticket's Decisions. This branch adds `host.jobs.cleanup(fn)` and makes `host.jobs.prune(ids)` return a promise, but the guard refuses a worker's change to `ticket.md` (the coordinator's, on main), so its Decisions section is still empty.
- Suggestion: the coordinator adds to Decisions: "API changes (`docs/plugin-api.md`, first paragraph), approved with the plan on 2026-11-06 (AR-D520): the host member `jobs.cleanup(fn)`, and `jobs.prune(ids)` returning a promise."
- Status: open

## F2. A hook past its time limit is given up, not stopped

- Kind: fix
- Found by: 2026-11-06-worker-926f0a0f (worker), 2026-11-06
- Where: `packages/core/src/job-cleanup.ts:19`
- What: past its 2 minutes the prune stops waiting for a hook and emits the notice, but the hook's promise, and whatever it started (a `docker` command over SSH), keeps running beside the next hook and the worktree's removal. The core has no way to cancel a plugin's promise.
- Suggestion: W3's docker hook bounds each of its own commands (`host.jobs.run`'s `limitSeconds`) so it ends within the core's limit; giving the hook an `AbortSignal` is an API change, out of this ticket.
- Status: open
