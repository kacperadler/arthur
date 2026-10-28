# AR0493 - Outcome

- Merged: 2026-10-28, `b89c5cb8`
- Branch: arthur/2026-10-28-worker-7b31d67c
- Reviews: review-4.md FAIL, review-5.md PASS
- Cost: worker $4.78, reviews $2.43; review rounds 2

## What went in

- The worktree guard refuses, as a command it cannot tell, a backslash-newline that does not follow a blank, any backslash-newline after a heredoc's `<<` or inside `$'...'`, and a `<<` after `((` or `$[` (arithmetic, not a heredoc). The check runs on the raw command and on every text a `bash -c`, `sh -c`, shell stdin or `eval` runs, before any of them is parsed. A backslash-newline after a blank, the usual line continuation, is read as before.
- Every command of the reviews that wrote into the main checkout is a refused test row; `docs/deploy.md` names the refusals.
- The earlier approach, a second pass that joined lines as bash does, was dropped after three failed reviews (AR-D243).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1163/1230 passed.

## Left open

- Deferred (client summary): F1. `$'…'` drops the backslash of an escape bash keeps
- Deferred (client summary): F2. An array subscript with `<<` (`a[1<<1]=5`) still hides the next lines from the guard
