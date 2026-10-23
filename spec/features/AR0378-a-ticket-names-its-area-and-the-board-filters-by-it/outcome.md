# AR0378 - Outcome

- Merged: 2026-10-23, `64352eb9`
- Branch: h/2026-10-23-ar0378-ticket-kinds-2c588335
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $13.62, reviews $1.69; review rounds 2

## What went in

- `spec/features/_template/ticket.md`: Kind is one of feat, fix, security, perf, refactor, test, docs, build, ci, chore, ux; every ticket migrated (bug→fix, cleanup→refactor, improvement→feat, risk→security).
- `packages/core/src/ticket-template.ts`, `board-text.ts`, `board.ts`: `planned` refuses a Kind outside the list; the board shows a Kind column and lists one kind.
- `packages/orchestration/src/board-commands.ts`: `/board KIND`, `/board PREFIX KIND` and `--kind`, refusals naming the list; autopilot accepts fix, refactor, chore, docs, test; delivery's changelog maps the new kinds. Budgets core 5939, orchestration 2330, delivery 1311, findings 254.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1076/1076 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40022499315

## Left open

- None: F1 dropped (accepted until the switch).
