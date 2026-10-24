# AR0381 - Outcome

- Merged: 2026-10-25, `6e0f0a1d`
- Branch: h/2026-10-24-ar0381-guard-git-alias-8d3d8f05
- Reviews: review-1.md PASS
- Cost: worker $3.05, reviews $0.85; review rounds 1

## What went in

- `packages/core/src/git-writes.ts`: `gitCall` reads the words before `git`, so `GIT_DIR=`/`GIT_WORK_TREE=` become guarded trees; a `-c alias.<sub>=` that defines the subcommand is expanded (any case, last definition wins, Git's quoting) and both the builtin and the alias are judged, each step dropping its definition so loops end; a shell alias, `-c include*`, `--config-env` aliases and env that brings in unreadable config (`GIT_CONFIG_GLOBAL=`, `HOME=`) are refused as unread. `git --attr-source <tree>` no longer hides the subcommand (F1, fixed).
- `packages/core/src/worktree-guard.ts`: passes the leading words to `gitCall` (file at 200 lines).
- `packages/core/test/worktree-guard.test.ts`: rows for alias chains, case, last definition, quoting, `sh -c`, builtin-named aliases, GIT_DIR/GIT_WORK_TREE and the unread refusals.
- `test/structure.test.ts`: core budget 6017 (Decision in the ticket).

## Checks on main

- `npm run check`: passed.
- `npm test`: 1086/1086 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40142584015

## Left open

- Findings: none open; no ticket made.
