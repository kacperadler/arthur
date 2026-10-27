# AR0429 - Outcome

- Merged: 2026-10-27, `55a02d90`
- Branch: arthur/2026-10-26-worker-71cba7c4
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $8.75, reviews n/a; review rounds 3

## What went in

- `packages/core/src/worktree-guard.ts`: the guard reads commands with the job's own `HOME` and `ARTHUR_JOB` (an unset one as nothing), judges a command after `env -C`/`--chdir` and `sudo -D`/`--chdir` (in every spelling, option clusters and GNU's unique prefixes) from that folder, and reads `$PWD`, `${PWD}` and an unquoted `~+` as the shell's current folder, inner shells of `bash -c`, `eval` and unquoted heredocs included.
- `packages/core/src/shell-words.ts`: an unquoted `~` at a word's start or after an assignment's `=` is the home folder; `$PWD` in an unquoted heredoc or here-string is marked for the outer shell's folder.
- `packages/core/test/worktree-guard.test.ts`, `env-guard.test.ts`: rows for each form, each caught by its own mutation.
- By AR-D113 the guard refuses only writes that really land in a guarded place, so `env -C /tmp rm README.md` from main now passes.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1121/1188 passed.

## Left open

- Tickets from findings: AR0471 (F1: other operators of `${PWD…}` and the known variables read as nothing), AR0472 (F2: an escaped variable in an unquoted heredoc), AR0473 (F3: a long option of sudo or env with its value hides the command).
- F4, F5 dropped (findings.md).
