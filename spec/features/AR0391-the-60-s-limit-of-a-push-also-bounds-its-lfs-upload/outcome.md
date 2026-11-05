# AR0391 - Outcome

- Merged: 2026-11-05, `19fc7230`
- Branch: arthur/2026-11-05-worker-52b0021b
- Reviews: review-1.md PASS
- Cost: worker $2.71, reviews $0.35; review rounds 1

## What went in

- `packages/github/src/github-git.ts`: `gitAway` has a `limit` of `"end"` (fixed 60 s, as before) or `"progress"` (60 s without output on stderr, `no progress in 60 s`), and splits git's stderr on `\r` too. The LFS upload runs with `GIT_LFS_FORCE_PROGRESS=1` and the `"progress"` limit; `git push`, `ls-remote` and the delete keep the fixed limit.
- `packages/github/docs/github.md`: "Pushes" explains the LFS upload's no-progress limit, `GIT_LFS_FORCE_PROGRESS=1`, the `no end in 60 s` and `no progress in 60 s` messages, and that git-lfs's error line wins over the progress line before it.
- `packages/github/test/github.test.ts`: new test for an upload that keeps moving past 60 s, a stalled upload killed at 60 s, and the `git push` after it still killed at 60 s even though it prints. The failing fake `git-lfs` in the existing LFS test now prints a `\r` progress line before its error.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1480/1551 passed.

## Left open

- Deferred (client summary): F1. the stderr buffer has no size limit
- Deferred (client summary): F2. the real git-lfs binary was never run
