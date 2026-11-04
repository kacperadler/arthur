# AR0608 - Outcome

- Merged: 2026-11-04, `4aea5715`
- Branch: arthur/2026-11-04-worker-3c83b683
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $1.69, reviews $0.81; review rounds 2

## What went in

- packages/orchestration/src/plans.ts: the plan guard reads every Plan line under a ticket's Goal (bullet `-`, `*`, `+` or `–`, or a number `1.`/`1)`; any spacing or case; bold or not) and refuses a worker when one is not exactly `- Plan: yes`, naming the ticket, the line and the accepted form; a ticket with no Plan line is not checked.
- packages/orchestration/test/plans.test.ts: one test where each misspelt, other-bullet, numbered or bold Plan line is refused, a second line next to `- Plan: yes` is refused, and a ticket with no Plan line starts a worker.
- packages/orchestration/docs/commands/plan.md: the worker refusals list the forms the guard reads as a Plan line, the misspelt-line refusal and its message.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1478/1549 passed.

## Left open

- Deferred (client summary): F1. some Goal lines still get past the guard and read as no plan
