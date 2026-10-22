# AR0284 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A job's question answered by policy still reaches the owner as a question

- Kind: improvement
- Found by: 2026-10-22-ar0284-decision-classes-3454afe5 (worker), 2026-10-22
- Where: `packages/orchestration/src/blocked-notice.ts` (the notice text), `packages/orchestration/src/decision-hooks.ts` (`askOfJob` returns only the id)
- What: when an approved class of kind `job` answers a blocked job's question by policy, the notice every channel sends still reads `<job> asks [AR-D3]: <question>` (asserted as it is in `packages/orchestration/test/decisions.test.ts`, "a job's question an approved class matches is answered by policy..."), so the owner's phone shows a question nobody waits on him for; only the coordinator's wake and its reply say it was decided by policy.
- Suggestion: let `askOfJob` return the policy answer too, and have the notice end `— answered by policy (<class id>): <decided>`; the notice's cut at one message's length and its one-per-block mark stay as they are.
- Status: ticket AR0285
