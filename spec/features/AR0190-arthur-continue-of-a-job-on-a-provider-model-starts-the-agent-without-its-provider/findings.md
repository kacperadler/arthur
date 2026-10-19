# AR0190 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A second run of commit-rules' prepare in the same worktree makes its `commit-msg` hook call itself

- Kind: risk
- Found by: 2026-10-19-ar0190-models-jobs-batch-f89d6b5b (worker), 2026-10-19
- Where: `packages/commit-rules/src/hook.ts` (`INSTALL`: `own="$(git config --type=path --get core.hooksPath || true)"`)
- What: the install reads the project's own hooks folder from `core.hooksPath` as Git reads it in the worktree; after a first install that is the worktree's own `arthur-hooks`, so a second install writes that folder into `own` and `commit-msg` then execs itself. Nothing runs a prepare twice today, but AR0190 (prepares again at `arthur continue`) would, and so would `projects`' install, which reinstalls over the agent's work. [INFERENCE: read from the lines; not run.]
- Suggestion: decide in AR0190 whether a continue calls every prepare (then the install skips an `arthur-hooks` already in place) or tells a prepare it is a continue, so only the variables are asked again.
- Status: open
