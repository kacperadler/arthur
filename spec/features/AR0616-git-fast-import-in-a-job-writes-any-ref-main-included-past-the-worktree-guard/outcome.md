# AR0616 - Outcome

- Merged: 2026-11-04, `61e2a455`
- Branch: arthur/2026-11-04-worker-6a0f19cc
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $4.64, reviews $0.85; review rounds 2

## What went in

- `packages/core/src/bash-refusal.ts`: refuses `git fast-import` aimed at the main checkout or any job worktree (the job's own included), with the reason `git fast-import with its refs on stdin`; the header comment lists it.
- `packages/core/src/git-writes.ts`: `writesRef` counts `fast-import` as a ref write (so links and guarded places are judged), and `WRITES_OPERANDS` judges the file its `--export-marks` names.
- `packages/core/test/worktree-guard.test.ts`: rows refusing `fast-import` through stdin, `<`, `cd`, `-C` main or another job's worktree, `--git-dir`, `GIT_DIR=`, an alias, a `.git` file link and an `--export-marks` into main; a passing row for `-C /tmp/other`; a check of the refusal text.
- `docs/deploy.md`: the `refs/replace` paragraph keeps main's AR0615 text and adds that the guard refuses `git fast-import` on the project's repository, lets it run outside every project, and checks its `--export-marks` file.
- `spec/features/AR0616-git-fast-import-in-a-job-writes-any-ref-main-included-past-the-worktree-guard/findings.md`: F1, the `sleep 300` processes a mutate run leaves behind.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1466/1537 passed.

## Left open

- Deferred (client summary): F1. A test run by `npm run mutate` leaves `sleep 300` processes behind
- Deferred (client summary): F2. F1 is still open: `npm run mutate` leaves `sleep 300` processes running after it ends
