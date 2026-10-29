# AR0484 - Outcome

- Merged: 2026-10-29, `ee93422d`
- Branch: arthur/2026-10-29-worker-82b42c14
- Reviews: review-1.md PASS
- Cost: worker $1.77, reviews $0.67; review rounds 1

## What went in

- The board refuses an entry whose `path` is not its own ticket's `spec/features/<id>-<slug>/ticket.md`, so no filing (a plan, a review, a ticket's own files) can write outside the project; every reader gets the board through that one check. `spec/build.json` is on the always-review list, so a branch that changes the board always gets a review.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1194/1262 passed.

## Left open

- Findings: F1 deferred (client summary): a ticket folder committed as a symlink is not covered; F2 deferred (client summary): jobs stop each other's `npm test` with `pkill -f`; F3 dropped (an untested `.` escape that cannot reopen the hole).
