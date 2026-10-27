# AR0472 - Outcome

- Merged: 2026-10-27, `0bd9e5cd`
- Branch: arthur/2026-10-27-worker-75604f27
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $1.71, reviews n/a; review rounds 2

## What went in

- `packages/core/src/shell-words.ts`: a new `outer()` reads the body of a heredoc with an unquoted delimiter as the outer shell hands it to the inner one: a backslash before `$`, `` ` ``, `\` or a newline is removed, and `$name`/`${name}` of a known variable (`HOME`, `ARTHUR_JOB`) becomes its value; other expansions stay for the inner shell. So `\$ARTHUR_JOB/<other job>/result` and `\$HOME/...` inside `bash <<EOF` are judged as the inner shell runs them. Quoted-delimiter heredocs are unchanged.
- `packages/core/test/worktree-guard.test.ts`: rows for the ticket's two forms, an escaped `$HOME`, a quoted `${ARTHUR_JOB}`, an escaped unknown variable and an escaped `$OLDPWD`, each refused; dropping `$` from the escape set fails a row.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1137/1204 passed.

## Left open

- Tickets from review notes: AR0493 (F1 added: a backslash-newline before a heredoc's delimiter line), AR0496 (F2, a `HOME=` before the command).
- F3 dropped (findings.md).
