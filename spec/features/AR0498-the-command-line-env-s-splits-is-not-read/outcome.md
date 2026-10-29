# AR0498 - Outcome

- Merged: 2026-10-29, `18285acb`
- Branch: arthur/2026-10-29-worker-8bf1122a
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $3.86, reviews $1.93; review rounds 2

## What went in

- `packages/core/src/worktree-guard.ts`: the string `env -S` / `--split-string` splits (every form: `-S 'v'`, `-Sv`, `-iS v`, `--split-string=v`, a prefix, nested, env's own options inside it) is read as the start of the command, the words after it appended, and judged again with the call's redirects; `HOME`, `ARTHUR_JOB` or `PWD` set inside it gets the unknown refusal; a string with a character env reads otherwise than bash (`\`, a backtick, `$`, `~`, a line break, `;&|<>()`) is refused as unknown.
- `packages/core/src/command-index.ts` (new): `commandIndex`, `WRAPPERS` and `RESERVED` moved out of the guard for the 200-line cap; it stops at `env -S` and returns its value.
- `packages/core/test/worktree-guard.test.ts`: 41 rows as strings only; `test/structure.test.ts`: core 6448 -> 6460 (AR-D317).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1219/1287 passed.

## Left open

- Deferred (client summary): F1. An empty quoted word vanishes, so `git -C '' -C <main>` passes the guard
- Deferred (client summary): F2. `env -S 'cd ...'; rm ...` is refused though env running cd moves nothing
