# AR0414 - Outcome

- Merged: 2026-10-28, `19577505`
- Branch: arthur/2026-10-28-worker-118c34f2
- Reviews: review-1.md PASS
- Cost: worker $0.94, reviews $0.39; review rounds 1

## What went in

- The worktree guard's refusal of `git stash` now tells a job to save its staged and unstaged changes with `git diff --binary HEAD` into `.arthur-stash/`, a folder whose own `.gitignore` holds `*`, and bring them back with `git apply`; so `git add -A` never commits the patch, in any repository, and staged changes are no longer lost.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1160/1227 passed.

## Left open

- Findings: F1 to F3 dropped (see findings.md).
