# AR0331 - Outcome

- Merged: 2026-10-23, `3043c2a`
- Branch: h/2026-10-23-ar0331-worktree-pointed-04fedd33
- Reviews: review-1.md PASS
- Cost: worker $3.98, reviews $1.00; review rounds 1

## What went in

- `packages/core/src/git-writes.ts`: `pointsAt` finds the git calls that can put a checkout on a branch another worktree holds (`--ignore-other-worktrees` and abbreviations, `checkout -B`, `switch -C`, `worktree add -f`, `symbolic-ref`).
- `packages/core/src/worktree-guard.ts`: refuses those unless they name the job's own branch, and treats a write to `<worktree>/.git` as a write to the main checkout. Core's budget 5869; the merge-time tip check stays AR0361's.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1058/1058 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/39994243809

## Left open

- Tickets from findings: AR0383 (F1), AR0384 (F2).
