# AR0310 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A listed machine with no git identity is not told, though its workers commit there

- Kind: risk
- Found by: 2026-10-23-ar0310-git-identity-chec-78843a24 (worker), 2026-10-23
- Where: `packages/machines/docs/commands/machines.md:43` (the check's script)
- What: AR0310 checks the identity of each project's checkout on the machine `arthur merge` runs on (`delivery <project> identity`). A worker on another machine (`arthur spawn --machine`) commits in a worktree there, with that machine's git config; the machines plugin's check runs `uname`, `arthur version`, `node`, `df` and `command -v`, never `git var GIT_AUTHOR_IDENT`/`GIT_COMMITTER_IDENT`, so a machine with no identity is reported online and its first worker's commit fails, or the worker makes up an identity with `git -c user.email=…` [INFERENCE: not run against a real remote machine].
- Suggestion: add `git var GIT_AUTHOR_IDENT && git var GIT_COMMITTER_IDENT` to the one ssh command the check already runs, and name it in that machine's doctor line with the same fix wording as `delivery <project> identity`; placement stays by labels.
- Status: open
