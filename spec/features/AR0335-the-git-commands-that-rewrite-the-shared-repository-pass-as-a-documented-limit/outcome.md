# AR0335 - Outcome

- Merged: 2026-10-26, `5141eaef`
- Branch: arthur/2026-10-26-worker-cba914c7
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md FAIL, review-4.md PASS
- Cost: worker $3.88, reviews n/a; review rounds 4

## What went in

- `packages/core/src/git-writes.ts`: a git call from a job that runs `gc`, `prune`, `repack`, `reflog expire`/`delete`/`drop`, `maintenance`, `filter-repo` or `worktree prune`, gives or writes `gc.*` or `maintenance.*` config (`-c`, `--config-env`, a `-c` alias, a `git config` write, any case), or runs `worktree add`/`move` with a target outside the worktrees folder (options before `--` or `--end-of-options` dropped, every word after them judged) is a write of the main checkout, refused naming it; reads (`reflog show`, `worktree list`, `git config --get`) pass.
- `packages/core/src/worktree-guard.ts`: the comment says so, folded to stay at 200 lines.
- `docs/deploy.md`: the guard's limits no longer list these commands as passing.
- Tests: refused and allowed rows in `packages/core/test/worktree-guard.test.ts`, the reviewers' mutations among them. Core line budget 6184 to 6206 (AR-D54).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1144/1150 passed.

## Left open

- F1 to F5: dropped under AR-D53 (see findings.md).
