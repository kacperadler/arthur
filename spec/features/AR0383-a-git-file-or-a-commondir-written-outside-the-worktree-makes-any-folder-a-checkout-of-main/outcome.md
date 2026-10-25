# AR0383 - Outcome

- Merged: 2026-10-25, `cdec3c07`
- Branch: h/2026-10-25-ar0383-git-file-commondi-a61177b8
- Reviews: review-1.md PASS
- Cost: worker $5.10, reviews $1.81; review rounds 1

## What went in

- `packages/core/src/worktree-guard.ts`: refuses a write of any path named `.git` or `commondir` (as given or through symlinks), anywhere; judges a git write through the links its folder, `-C`, `--git-dir`/`GIT_DIR` or `--work-tree` has (a `.git` file upward, a gitfile of any name, each `commondir`); a `git worktree add` worktree still passes. The job's own worktree is an unnamed place entry (a guarded place nested in it is now refused). File at 200 lines.
- `packages/core/src/git-link.ts` (new): reads those links the way Git does; a FIFO named `.git` does not hang it.
- `packages/core/src/git-writes.ts`: `init` counts as a write; `GIT_COMMON_DIR=` is treated like `GIT_DIR=`.
- `packages/core/test/worktree-guard.test.ts`: 26 refused and 10 passing calls, the passing ones run for real, and five links shown to move main without the guard.
- `docs/deploy.md`: the rule and its limit. `test/structure.test.ts`: core budget 6066 (Decision in the ticket).

## Checks on main

- `npm run check`: passed.
- `npm test`: 1088/1088 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40146573244

## Left open

- Tickets from findings: AR0395 (F1).
