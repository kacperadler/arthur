# AR0475 - Outcome

- Merged: 2026-10-27, `ae463a28`
- Branch: arthur/2026-10-27-worker-042433a0
- Reviews: review-1.md PASS
- Cost: worker $1.86, reviews n/a; review rounds 1

## What went in

- `test/structure.test.ts`: `BUDGETS` holds one budget per line with a blank line after each, so raises to neighbouring packages merge without a conflict (AR-D143); the 761-line raise log is gone, and the reason for a raise now lives in the ticket's Decisions. The 19 numbers are unchanged.
- `packages/develop/src/plugin-new.ts`: `arthur plugin new` reads only that form and adds the new budget last; a file with zero or two such blocks is refused with a message naming the expected form; a name already budgeted is matched by whole line.
- `packages/develop/test/plugin-new.test.ts`: covers the new form and refuses an empty file, the old one-line form, budgets without the blank line and a comment inside the block.
- `packages/develop/docs/commands/plugin.md`: describes the form and where a raise's reason goes.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1128/1195 passed.

## Left open

- Tickets from findings: AR0478 (F1).
