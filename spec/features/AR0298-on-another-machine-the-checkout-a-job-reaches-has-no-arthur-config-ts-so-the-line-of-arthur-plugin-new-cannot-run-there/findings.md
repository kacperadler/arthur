# AR0298 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A new plugin's ticket without a plan can still be placed on another machine

- Kind: improvement
- Found by: 2026-10-22-ar0298-8e2fe51c (worker), 2026-10-22
- Where: `packages/machines/src/machine-place.ts:40` (`need`), `packages/develop/src/plugin-new.ts` (`pluginNewSection`)
- What: AR0298 places a new plugin's worker on the local machine through the plan (the planner's section, then `--machine local` in `plan-ended.md` step 4). A ticket without `- Plan: yes` has no such step: the machines plugin places it by labels only, and a ticket's JSON block can name `requires` but no machine, so its worker may start on another machine, read that it cannot run `arthur plugin new` there, and end; the coordinator then spawns it again with `--machine local`, as the worker's final message says. One start is wasted, and the respawn rests on the coordinator reading that message.
- Suggestion: let a ticket's JSON block pin its machine (for example `"machine": "local"`), read by `need` beside `requires`, and have the planner or the ticket's author set it for a new plugin; or have develop refuse a worker's spawn on another machine for a ticket that makes a new plugin, if that can be told without parsing the human's Markdown. What stays out: the CLI loading plugins without `arthur.config.ts`.
- Status: ticket AR0304
