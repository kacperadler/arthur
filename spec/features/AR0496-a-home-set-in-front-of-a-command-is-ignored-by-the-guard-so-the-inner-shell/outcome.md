# AR0496 - Outcome

- Merged: 2026-10-29, `0e336859`
- Branch: arthur/2026-10-28-worker-821d07d3
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md FAIL, review-4.md FAIL, review-5.md FAIL, review-6.md FAIL, review-7.md FAIL, review-8.md PASS, review-9.md PASS
- Cost: worker $19.45, reviews $7.54; review rounds 9

## What went in

- `packages/core/src/worktree-guard.ts`: a call that sets `HOME`, `ARTHUR_JOB`, `PWD` or `OLDPWD` in front of a command, through `export`, `declare` and the other declarations, or again later in the line, gets the unknown-path refusal; a declaration, `env` or `sudo` may set only a plain literal name, so a run-time, quoted, braced, globbed or indexed name is refused too.
- `packages/core/src/shell-words.ts`: marks a `$` or backtick that makes a name at run time, so the guard can refuse it.
- `packages/core/test/worktree-guard.test.ts`: the ticket's two commands, every review's bypass row and each run-time-name mark, as strings only.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1211/1279 passed.

## Left open

- Deferred (client summary): F1. A known variable set by `for`, `read`, `printf -v`, a nameref or `eval $v=…` still passes the guard
- Deferred (client summary): F2. A glob as the command after `env` or `sudo` still passes the guard
- Ticket AR0498: `HOME` set inside `env -S` (AR-D305)
