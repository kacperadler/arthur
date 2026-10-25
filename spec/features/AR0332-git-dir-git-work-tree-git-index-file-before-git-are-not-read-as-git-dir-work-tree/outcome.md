# AR0332 - Outcome

- Merged: 2026-10-25, `059696a4`
- Branch: arthur/2026-10-25-worker-10b542de
- Reviews: review-1.md PASS
- Cost: worker $0.74, reviews n/a; review rounds 1

## What went in

- `packages/core/src/git-writes.ts`: `gitCall` adds the values of `GIT_INDEX_FILE=` and `GIT_OBJECT_DIRECTORY=` (beside `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR`), before `git` or after `env`, to the paths it judges, so a git write through them into the main checkout is refused; `worktree-guard.ts`'s comment says so. Net zero core lines.
- `packages/core/test/worktree-guard.test.ts`: `GIT_INDEX_FILE=<main>/.git/index git add .` and `env -u X GIT_OBJECT_DIRECTORY=<main>/.git/objects git commit` refused naming the main checkout; `GIT_AUTHOR_NAME=x git commit` passes.
- Review PASS (review-1.md). Merged on the owner's standing AR-D11.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1106/1106 passed.

## Left open

- Tickets from findings: AR0415 (F1), AR0416 (F2).
