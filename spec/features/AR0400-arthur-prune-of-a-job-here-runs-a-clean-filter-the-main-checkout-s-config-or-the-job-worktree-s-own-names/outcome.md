# AR0400 - Outcome

- Merged: 2026-10-26, `39aec933`
- Branch: arthur/2026-10-26-worker-5321f8e3
- Reviews: review-1.md PASS
- Cost: worker $0.88, reviews n/a; review rounds 1

## What went in

- `packages/core/src/job-records.ts` (`prune`): a prune of a job on this machine keeps its worktree, branch and record, and runs nothing, while the worktree's Git config (shared or its own `config.worktree`) names a program (`kept its worktree, branch and record: git worktree: <file> sets <key>`), as `arthur remote-job prune` does since AR0394.
- `packages/core/test/job-records.test.ts`: both configs, a control that the filter really runs on `git status`, and a deleted worktree.
- Docs: `prune.md`, `docs/deploy.md`. Core line budget 6325 (AR-D99 by policy).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1115/1181 passed.

## Left open

- None.
