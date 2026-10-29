# AR0497 - Outcome

- Merged: 2026-10-29, `4d7b2940`
- Branch: arthur/2026-10-29-worker-3d4c552f
- Reviews: review-1.md PASS
- Cost: worker $1.32, reviews $0.63; review rounds 1

## What went in

- `packages/core/src/worktree-guard.ts`: the guard knows the long options of `timeout`, `nice`, `ionice`, `stdbuf`, GNU `time` and `xargs` that take a value, whole or as a prefix every match of which takes one, so the command after them is judged; `xargs -i`/`-l` and `ionice -t` no longer swallow the next word, and `ionice -P`/`-u` take one.
- `packages/core/test/worktree-guard.test.ts`: 36 rows, the ticket's own command and each option, whole and as a prefix, refused as the main checkout.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1211/1279 passed.

## Left open

- Deferred (client summary): F1. A value-taking option that is a prefix of a no-value option would pass silently; only a comment holds that rule
- Deferred (client summary): F2. An ambiguous sudo prefix such as `--ch` is now read as `--chdir`; sudo itself refuses it
