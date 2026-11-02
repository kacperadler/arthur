# AR0395 - Outcome

- Merged: 2026-11-02, `a6d02e02`
- Branch: arthur/2026-11-02-worker-3b09a3f0
- Reviews: review-1.md PASS
- Cost: worker $4.00, reviews $0.54; review rounds 1

## What went in

- packages/core/src/bash-refusal.ts: refuses a git write whose folder, `--git-dir`, `--work-tree` or `GIT_*` path lies in a path the same bash call writes (redirect, `mv`, `tee`, `sponge`, `patch`, `sed -i`, `cp` family, `ln`, `dd`), before or after the git call, via the second pass; `mkdir`, `touch` and removals stay unrecorded; header comment updated.
- packages/core/test/worktree-guard.test.ts: AR0395 test: 10 refused calls that each move main when run, `cp <file> .` and a written `--work-tree` refused, 5 passing calls that leave main as it was, and the exact refusal text.
- test/structure.test.ts: core line budget 7092 → 7099.
- docs/deploy.md: worktree guard paragraph describes the new refusal, its false positive and that a program-made link stays unseen, with `arthur merge` behind it.
- spec/features/AR0395-a-link-to-the-repository-made-and-used-in-one-bash-call-still-moves-main/findings.md: new; F1 (the sandbox's `refs` folder is writable), F2 (split `bash-refusal.ts`).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1423/1494 passed.

## Left open

- Deferred (client summary): F1. The job's sandbox writes every ref, so a program a job runs can still move main
- Deferred (client summary): F2. bash-refusal.ts is yellow (207 lines)
- Deferred (client summary): F3. a GIT_DIR exported in the same call is not checked against what the call writes
- Deferred (client summary): F4. confirms the worker's F1
