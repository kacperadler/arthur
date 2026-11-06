# AR0628 - Outcome

- Merged: 2026-11-06, `631ac206`
- Branch: arthur/2026-11-06-worker-63366938
- Reviews: review-1.md PASS
- Cost: worker $2.62, reviews $0.51; review rounds 1

## What went in

- packages/core/src/bash-refusal.ts: refuses `git fast-import` on any repository when a text the call runs holds a pipe, an input redirect, a heredoc, a here-string or a process substitution (`fed`, set in `parse`); the header comment says so.
- packages/core/test/worktree-guard.test.ts: refused rows for a stdin `option git export-pack-edges=<main>/x` line and every way tested to feed fast-import's stdin, including through wrappers, `eval` and `bash -c`; the allowed rows now hold plain fast-import calls with no feed.
- docs/deploy.md: the `refs/replace` paragraph says a fast-import in a call that may feed it is refused on any repository, and why.
- test/structure.test.ts: core line budget raised from 7238 to 7239.
- spec/features/AR0628-git-fast-import-appends-to-any-file-named-by-a-stdin-option-git-export-pack/findings.md: F1 (`coproc` not judged), F2 (stdin from outside the call).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1511/1582 passed.

## Left open

- Deferred (client summary): F1. The guard does not judge the command after `coproc`
- Deferred (client summary): F2. A plain fast-import's stdin can still come from outside the call
- Deferred (client summary): F3. `coproc` feeds fast-import's stdin unseen
