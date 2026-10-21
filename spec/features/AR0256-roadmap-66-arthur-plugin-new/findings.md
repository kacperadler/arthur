# AR0256 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `arthur plugin new` writes into the project's checkout, never a job's worktree

- Kind: improvement
- Found by: 2026-10-21-ar0256-roadmap-66-plugin-18c71d6b (worker), 2026-10-21
- Where: `packages/develop/src/plugin-new.ts` (`pluginCommand`), `packages/core/src/cli.ts:58`
- What: the command writes into the checkout of the main project or the one `--project` names, as listed in `arthur.config.ts`, the way `arthur changelog` does. The CLI loads `arthur.config.ts` from its working folder, which a job's worktree does not have (it is gitignored), so the worker on a new plugin's ticket cannot run `arthur plugin new` on its own branch; the coordinator or the owner running it leaves the new package uncommitted in the main checkout, outside any job and review. Seen by reading `cli.ts:58` (`loadConfig("arthur.config.ts")`) and `.gitignore`; not run inside a job.
- Suggestion: let a job run it on its worktree: a `--root <path>` limited to a job's own worktree (from `ARTHUR_JOB`'s record), or the coordinator's role naming the command only as the first step of a worker's task. Out: changing where `arthur.config.ts` is read.
- Status: open
