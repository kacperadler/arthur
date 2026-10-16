# AR0023 - Outcome

- Merged: 2026-10-16, `29ed9c0`
- Branch: h/2026-10-16-ar0023-worktree-guard-a197f8a5
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $6.45, reviews $1.60; review rounds 3

## What went in

- `packages/core/src/worktree-guard.ts`, `git-writes.ts`: every job loads a guard that refuses a file tool or bash write into the main checkout, `.arthur/` or another job's worktree: redirects, writing commands, git writes through `-C`/`--work-tree`/`worktree`, `fetch`, `push`, `tag`, `branch`, `remote`, `notes`, `git stash` (but list and show), `cd`/`pushd` then a write, the bash `cwd`, symlinks, `bash -c`, `eval`, heredocs. Unrefused git maintenance commands are named in `docs/deploy.md`.
- `shell-words.ts`: `shellCommands`, shared with the env guard.

## Checks on main

- `npm run check`: passed.
- `npm test`: 233/233 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0059 (F1).
