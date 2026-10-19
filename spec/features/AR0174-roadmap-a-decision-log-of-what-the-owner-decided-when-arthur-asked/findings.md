# AR0174 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The roadmap has no entry yet for decisions pre-approved from the decision log

- Kind: improvement
- Found by: 2026-10-19-ar0174-decision-log-road-db3b3fa9 (worker), 2026-10-19
- Where: `spec/roadmap.md`, entry 96
- What: AR0174's Done means asks for "a later step, its own entry" that lets a class of decisions the owner always answers the same way be proposed as pre-approved, like autopilot (29), never without the owner's approval; the same Done means asks for one new entry, so entry 96 only names that step as a later entry and the roadmap has no entry for it.
- Suggestion: a roadmap entry after 96 (and after the evals, 67, whose agreement rate between the coordinator's recommendation and the owner's answer is the evidence for a class): the coordinator proposes a class (a kind and what its questions share, with the decisions that back it), the owner approves or refuses it through `arthur decision`, and an approved class answers its questions by policy, each recorded as such in the log and the ticket's Decisions, revocable by the owner. Out: the decision models (AR0129).
- Status: open
