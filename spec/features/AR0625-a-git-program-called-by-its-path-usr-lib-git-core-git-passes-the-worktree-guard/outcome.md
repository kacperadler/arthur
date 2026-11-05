# AR0625 - Outcome

- Merged: 2026-11-05, `b445e4cb`
- Branch: arthur/2026-11-05-worker-54e8b304
- Reviews: none
- Cost: worker $1.45, reviews $0.00; review rounds 0

## What went in

- `packages/core/src/bash-refusal.ts`: checks a program whose name starts with `git-`, by any path, as `git <sub>` under every git rule; the header comment says so.
- `packages/core/test/worktree-guard.test.ts`: rows refusing `git-fast-import`, `git-update-ref` and `git-replace` by full path (plus by name, `sudo`, `bash -c`, `cd` into main with `git-commit`), an allowed row for read-only and own-branch calls, and a check of the refusal text.
- `docs/deploy.md`: says Git's own programs, called by path or name, are judged as `git <sub>` by the worktree guard.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1479/1550 passed.

## Left open

- Findings: none; no findings.md on this ticket.
