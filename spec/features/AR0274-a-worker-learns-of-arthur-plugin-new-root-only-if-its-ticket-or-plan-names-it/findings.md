# AR0274 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. On another machine the checkout a job reaches has no arthur.config.ts, so the line of `arthur plugin new` cannot run there

- Kind: risk
- Found by: 2026-10-22-ar0274-117ece9b (worker), 2026-10-22
- Where: `packages/develop/src/plugin-new.ts` (`pluginNewSection`), `packages/core/src/job-machine.ts:147` (`reach`), `packages/develop/docs/commands/plugin.md`
- What: the planner's and the worker's section, as `plugin.md` before it, says to run `cd <checkout> && arthur plugin new ... --root <worktree>` with `<checkout>` the first line of `git worktree list`. For a job on another machine that first line is the repository `arthur remote-job repo` made there (`reach`, `repositoryThere`), which holds the project's tracked files; `arthur.config.ts` is ignored by Git, so [INFERENCE] it is not there, and the CLI answers `unknown command plugin` (exit 2), as it does from a worktree (the AR0274 test's last assertion). Not run on a real second machine.
- Suggestion: either the section and `plugin.md` say that a new plugin's ticket runs on the local machine (and orchestration places such a job there), or `arthur plugin new` reads its project list without the config when `ARTHUR_JOB` names a record. The local path stays as it is.
- Status: ticket AR0298
