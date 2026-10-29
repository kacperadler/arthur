# AR0546 - Outcome

- Merged: 2026-10-29, `a634a0ac`
- Branch: arthur/2026-10-29-worker-29e2a868
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.99, reviews $1.36; review rounds 2

## What went in

- `packages/core/src/worktree-guard.ts`: a call that passes is judged a second time with every git-config assignment of the whole call (`GIT_CONFIG*`, `HOME`, `XDG_CONFIG_HOME`) counted from its start, so a function body, a trap's command or a loop's next round sees an `export` or a prefix assignment (`XDG_CONFIG_HOME=/tmp/h f`) written after it; `trap`'s command is judged like `eval`'s text, in a subshell. A git call anywhere in a call that sets such config is refused (AR-D322).
- `packages/core/src/command-index.ts`: skips `function` and its name, so the first command of a `function f { ... }` body is judged.
- `packages/core/test/worktree-guard.test.ts`: the ticket's commands and review 1's four as refused rows, strings only; `docs/deploy.md`: the config sentence names a prefix assignment; `test/structure.test.ts`: core 6460 -> 6467 (AR-D321).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1220/1288 passed.

## Left open

- Deferred (client summary): F1. A function's body or a trap's command is judged in the folder where it is defined, not where it runs
- Deferred (client summary): F2. The guard does not read `coproc`, so what runs under it is never judged
