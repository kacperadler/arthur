# AR0018 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A pruned worker whose branch Git keeps loses its worktree, so `arthur continue` on it cannot start

- Kind: risk
- Found by: 2026-10-16-ar0018-jobs-list-prune-d-436045b4 (worker), 2026-10-16
- Where: `packages/core/src/job-records.ts` (`prune`), `packages/core/src/job-control.ts` (`continueJob`)
- What: `arthur prune` removes a clean worktree first, since Git refuses to delete a branch that a worktree has checked out, then tries `git branch -d`; a branch with unmerged commits stays with the record, but its worktree is gone (tested in `job-records.test.ts`, "arthur prune frees a merged worker's worktree..."). `arthur continue` on that job still passes its checks and starts the wrapper, whose agent has no working folder. [INFERENCE: the agent's spawn with a missing `cwd` fails, and the job ends `failed: the agent did not start`; not run.]
- Suggestion: either keep the worktree of a job whose branch is not merged into HEAD (ask `git merge-base --is-ancestor <branch> HEAD` before removing it, and say so in the line), or have `continueJob` refuse a job whose worktree is gone with the reason. Out: deleting the branch with `-D`.
- Status: ticket AR0071
