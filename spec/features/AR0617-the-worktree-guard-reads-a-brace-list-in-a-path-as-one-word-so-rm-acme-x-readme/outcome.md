# AR0617 - Outcome

- Merged: 2026-11-04, `b1a54ff9`
- Branch: arthur/2026-11-04-worker-cb7707c9
- Reviews: review-1.md PASS
- Cost: worker $3.88, reviews $0.41; review rounds 1

## What went in

- packages/core/src/shell-braces.ts: new; `braces` expands a word's comma lists and sequences as bash does (undefined past 256 words); `expanded` applies it to a parsed command's words, write targets and dynamic indexes, a word past the limit unknown (`\0`).
- packages/core/src/bash-refusal.ts: `parse` expands brace lists in every command it judges; the unknown-path message and contract comment name brace lists over 256 words.
- packages/core/src/env-refusal.ts: uses the shared `braces` (keeping an over-limit word as is), its local copy removed; sequences are now expanded too.
- packages/core/src/git-writes.ts: comment says only a quoted brace list reaches the refspec check whole.
- packages/core/test/worktree-guard.test.ts: AR0617 rows (list in a path, in and around `-C`, nested, sequence, redirect, inside `bash -c`, with a run-time part, quoted/escaped passing, 256 passing, 257 and over-limit lists unknown); UNKNOWN message and AR-D245 comment updated.
- packages/core/test/env-guard.test.ts: rows for a sequence naming `.env` and an over-limit list.
- packages/core/test/shell-braces.test.ts: new; `braces` compared against real bash, non-lists kept, the 256/257 limit.
- test/structure.test.ts: core line budget raised from 7163 to 7198.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1466/1537 passed.

## Left open

- Deferred (client summary): F1. harmless large lists are now refused
