# AR0381 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `git --attr-source <tree>` hid the subcommand and every option after it from the guard

- Kind: security
- Found by: 2026-10-24-ar0381-guard-git-alias-8d3d8f05 (worker), 2026-10-24
- Where: `packages/core/src/git-writes.ts:6` (`VALUE_OPTIONS`)
- What: git 2.43 takes `--attr-source HEAD` (and `--config-env name=VAR`) as an option with a separate value (run in a temporary repository: `git --attr-source HEAD status -s` and `X=config git --config-env alias.c=X c a.c d` both ran). `gitCall` took the value as the subcommand, so `git --attr-source HEAD -C ../../acme commit -m x` was read as the subcommand `HEAD` and passed.
- Suggestion: both in `VALUE_OPTIONS`, with a row in `worktree-guard.test.ts`.
- Status: fixed in 5ddb6918
