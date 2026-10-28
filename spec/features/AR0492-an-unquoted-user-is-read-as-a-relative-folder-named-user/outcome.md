# AR0492 - Outcome

- Merged: 2026-10-28, `09d8b6d7`
- Branch: arthur/2026-10-28-worker-6a0ef2e0
- Reviews: review-1.md PASS
- Cost: worker $1.31, reviews $0.77; review rounds 1

## What went in

- The worktree guard now refuses an unquoted `~name` (another user's home, or a `dirs` entry such as `~1`) at the start of a word or right after an assignment's `=`, as a path it cannot tell, so `rm ~acme/arthur/README.md` is refused. A quoted or escaped `~`, and a `~` in the middle of a word, stay literal, as in bash; `~`, `~+` and `~-` work as before.
- The refusal message names the unquoted `~name` as a reason.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1163/1230 passed.

## Left open

- Tickets from findings: AR0547 (F1); F2, F3 dropped.
