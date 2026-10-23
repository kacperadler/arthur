# AR0330 - Outcome

- Merged: 2026-10-23, `8702f7e`
- Branch: h/2026-10-23-ar0330-git-config-eb39f9d4
- Reviews: review-1.md PASS
- Cost: worker $6.58, reviews $1.35; review rounds 1

## What went in

- `packages/core/src/git-writes.ts`: reads `git config` and tells a write (any scope, `--file`, abbreviated and `--no-` options, subcommands) from a read.
- `packages/core/src/worktree-guard.ts`: refuses a job's `git config` write to the shared config, `--global`, `--system` or a guarded `--file`; `--worktree` passes only in the job's own checkout.
- `packages/core/src/git.ts`, delivery and github: Arthur's own git calls in a main checkout run with `core.hooksPath=/dev/null` and `core.fsmonitor=false`. Budgets core 5845, delivery 1310, github 635.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1058/1058 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/39988552928

## Left open

- Tickets from findings: AR0379 (F1), AR0380 (F2), AR0381 (F3), AR0382 (F4).
