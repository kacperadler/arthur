# AR0355 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A decision is used up when a later check refuses the spawn

- Kind: ux
- Found by: 2026-10-26-review-106fdff2, 2026-10-26-review-5e846508 (reviewer, non-blocking notes), 2026-10-26
- Where: `packages/orchestration/src/decision-use.ts:47-55`
- What: the owner answers again; nothing is lost.
- Status: dropped (fails closed; `decision.md` says so)

## F2. Autopilot's and a plugin's own `budget 0` are not checked

- Kind: security
- Found by: 2026-10-26-review-5e846508 (reviewer, non-blocking note), 2026-10-26
- Where: `AutopilotRequest.budgetUsd`, `host.jobs.spawn`
- What: the ticket named `spawn` and `continue` only.
- Status: dropped (autopilot's budget is capped above 0 by its own rules; a plugin's spawn is the owner's own code; documented)

## F3. A decision asked with a short job id is refused at use

- Kind: ux
- Found by: 2026-10-26-review-106fdff2 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/orchestration/src/decision-commands.ts`
- What: `--job` is stored as typed.
- Status: dropped (fails closed; the refusal names the full id to use)
