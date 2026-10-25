# AR0333 - Outcome

- Merged: 2026-10-25, `00a0c619`
- Branch: arthur/2026-10-25-worker-9a6298d8
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md FAIL, review-4.md FAIL, review-5.md PASS
- Cost: worker $5.31, reviews n/a; review rounds 5

## What went in

- `packages/core/src/worktree-guard.ts`: the guard keeps `previous` (OLDPWD) beside `cwd`. `cd -`, `~-`, `$OLDPWD` and `${OLDPWD}` go to it; a bare `pushd` swaps `cwd` with the top of the stack; an empty or unset OLDPWD is refused as unknown. OLDPWD is followed through `=`, `+=`, `export`/`declare`/`typeset`, `unset` (not `-f`, not in a pipeline), subshells, and a prefix `OLDPWD=` before `cd`, a shell (`bash -c`, `env … bash -c`, a heredoc) or `eval`. `NAME+=value` before a command counts as an assignment, so `X+=1 rm <main>/README.md` is refused too. Paths in redirects, `ln`, `git -C`/`--git-dir`/`--work-tree` resolve through `~-`. Loops became `.map(...).find(Boolean)` to stay at 200 lines.
- `packages/core/src/shell-words.ts`: `$OLDPWD` and `${OLDPWD}` are read as `~-`.
- `packages/core/test/worktree-guard.test.ts`: rows for each form above, the ticket's three commands refused naming the main checkout.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1108/1108 passed.

## Left open

- Tickets from findings: AR0421 (F1), AR0422 (F2, F3, F4); F5, F6 dropped. Split off by AR-D17 and AR-D19: AR0420.
