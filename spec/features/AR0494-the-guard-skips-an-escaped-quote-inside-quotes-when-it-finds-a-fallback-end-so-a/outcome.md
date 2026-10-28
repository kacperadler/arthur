# AR0494 - Outcome

- Merged: 2026-10-28, `9b488940`
- Branch: arthur/2026-10-28-worker-444ea31a
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $1.89, reviews $1.63; review rounds 3

## What went in

- The worktree guard now ends a `${...}` or `$(...)` where bash does when a quote inside it is escaped: a `\"` inside double quotes no longer closes them, a backslash-newline counts as an escape, and a quote never closed runs to the end of the text. So `echo "${x:-"\""}"; rm ../../acme/README.md` is refused, naming the main checkout.
- Test rows cover the escaped quote, a backslash-newline in double quotes, and a double or single quote never closed inside `${...}`.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1163/1230 passed.

## Left open

- Deferred (client summary): F1. limits.test.ts waits time out when the machine runs other suites
- Deferred (client summary): F2. `\'` inside `$'...'` quoting is not honoured when the guard finds the end of a `${...}`
- Dropped: F3.
