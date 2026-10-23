# AR0316 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A listed machine without git is told to set a git identity, and stays online

- Kind: risk
- Found by: 2026-10-23-ar0316-15daeb35 (worker), 2026-10-23
- Where: `packages/machines/src/machine-check.ts:21` (the `IDENTITY` loop), `packages/machines/src/machines.ts:119` (its fix)
- What: on a machine whose command over ssh finds no `git`, the identity loop prints `identity GIT_AUTHOR_IDENT /bin/sh: 1: git: not found` (run: `env -i PATH=/nonexistent /bin/sh -c '<the loop>'`), so its doctor line reads `missing: git var GIT_AUTHOR_IDENT there: sh: 1: git: not found` with the fix `git config --global user.name ...`, which cannot work without git; the machine stays online and takes jobs whose worktree cannot even be created there [INFERENCE: the core's remote job runner was not read].
- Suggestion: when the loop's `git var` exits 127, say `git is not there` with the fix `install git there, on the PATH of a command over ssh (docs/deploy.md)`, or make no git an offline reason as no `arthur` is; out: any other change to the identity check.
- Status: ticket AR0318
