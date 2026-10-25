# AR0382 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A spawn's push to another machine runs a program the repository's config there names, hooks off or not

- Kind: security
- Found by: 2026-10-24-ar0382-remote-hooks-4f172ca4 (worker), 2026-10-25
- Where: `packages/core/src/job-machine.ts:158` (the push in `reach`), `packages/core/src/remote-job.ts:27` (the `repo` step that runs before it)
- What: the push of a job's base into `repos/<project>.git` on another machine is checked only against the main checkout's config (`configRefusal(root)` in `gitOver`); the repository there, whose shared config a job's program there can write, is checked only later, at the `add` step's `addWorktree`. `git receive-pack` there honors keys that name a program, so the push runs them before any check. Reproduced with a hookless push (`--receive-pack="git -c core.hooksPath=/dev/null receive-pack"`, as this ticket's fix sends) into a bare repository whose config sets `core.alternateRefsCommand=<script>` and whose `objects/info/alternates` names another repository: the script ran three times.
- Suggestion: let `arthur remote-job repo` refuse, as `addWorktree` does, when `configRefusal` of the repository there is not empty (printing the refusal, which `reach` throws before the push), with a test on the fake machine of `machine.test.ts`. The fetch back (`git upload-pack` there) and the prune's `git worktree remove` there are not covered by this; check each for the same keys.
- Status: ticket AR0394
