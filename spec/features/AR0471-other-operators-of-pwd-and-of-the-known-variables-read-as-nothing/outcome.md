# AR0471 - Outcome

- Merged: 2026-10-27, `6bcc4140`
- Branch: arthur/2026-10-27-worker-c28e3457
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md FAIL, review-4.md FAIL, review-5.md PASS
- Cost: worker $7.15, reviews n/a; review rounds 5

## What went in

- `packages/core/src/shell-words.ts`: a `${…}` of `PWD`, `OLDPWD`, `HOME` (set) or `ARTHUR_JOB` (set) with an operator the guard does not read (`%`, `#`, `/`, `^`, `:offset`, an index other than 0, `${!x}`, `${#x}`) gives the unknown marker, so the guard refuses the call; `-`, `=`, `?` and `+` read as before. A fallback word is read with the known variables, so a nested operator (`${x:-${ARTHUR_JOB%/*}}`) is refused too. An unquoted fallback holding a blank or one of `<>;&|()#` is refused rather than split (AR-D157); a double-quoted fallback is read as double-quoted text, so `~` stays text there (AR-D161), and one holding `$'…'` or `$"…"` is refused. In an unquoted heredoc, `${PWD:-x}` and the like read as the outer shell's folder.
- `packages/core/src/worktree-guard.ts`: the unknown-path refusal names these forms.
- `packages/core/test/worktree-guard.test.ts`: rows for every bypass the five reviews found (nested operators, redirects and `#` in a fallback, `IFS` and `time`/`!` splits, `~` in a double-quoted fallback), each refused, and the quoted and plain forms that must still pass.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1135/1202 passed.

## Left open

- Tickets from findings: AR0491 (F1, a command substitution in a fallback word is never judged), AR0492 (F2, an unquoted `~user`).
- Tickets from review notes: AR0493 (F3, a backslash-newline after `$`), AR0494 (F4, `closing()` ignores an escaped quote and hides a command).
