# AR0012 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A project with a branch named `arthur` can spawn no worker

- Kind: risk
- Found by: 2026-10-16-ar0012-job-runner-spawn-b046ca2a (worker), 2026-10-16
- Where: `packages/core/src/jobs.ts` (`newJob`, the branch `arthur/<id>`)
- What: a worker's branch is `arthur/<id>`. In a repository that has a branch named exactly `arthur`, Git cannot create `refs/heads/arthur/<id>` beside `refs/heads/arthur`, so every worker spawn fails with Git's message (`arthur spawn: git worktree: fatal: cannot lock ref 'refs/heads/arthur/…': 'refs/heads/arthur' exists; …`, exit 1). Nothing is left behind (no worktree, record or branch; seen in a throwaway run: `git init`, `git branch arthur`, `arthur spawn "Go."`). Read-only kinds are not affected. An exact branch name that exists is handled: the spawn draws another id.
- Suggestion: refuse such a spawn with Arthur's own line naming the `arthur` branch and what to do (rename it), or pick a prefix that cannot clash; decide which with the owner.
- Status: open
