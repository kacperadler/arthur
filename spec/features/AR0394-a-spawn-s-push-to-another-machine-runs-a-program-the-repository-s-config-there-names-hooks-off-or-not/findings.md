# AR0394 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `arthur prune` of a job here runs a clean filter the main checkout's config or the job worktree's own names

- Kind: security
- Found by: 2026-10-25-ar0394-remote-push-confi-a2787f57 (worker), 2026-10-25
- Where: `packages/core/src/job-records.ts:151`
- What: the prune of a job on `local` runs `git worktree remove <worktree>` (hooks and fsmonitor off) with no `configRefusal` first. `git worktree remove` runs `git status` in the worktree, which runs `filter.<driver>.clean` from the repository's shared `.git/config` or the worktree's own `config.worktree` on a file whose stat is stale and whose `.gitattributes` names that driver; a job's program can write both. Reproduced with Git 2.43 on a bare repository (the same call AR0394 now refuses on another machine): the filter ran once from the shared config and once from a worktree's `config.worktree` (`git -C <repo> -c core.hooksPath=/dev/null -c core.fsmonitor=false worktree remove <wt>`), and not with `--force`.
- Suggestion: as `arthur remote-job prune` does since AR0394, keep the worktree, branch and record when `configRefusal(<worktree>)` is not empty while the worktree exists (`kept its worktree, branch and record: git worktree: <file> sets <key>, …`), with a test in the prune tests; `removeWorktree` (`--force`) runs no `git status` and stays as it is.
- Status: open
