# AR0618 - Outcome

- Merged: 2026-11-05, `720a6871`
- Branch: arthur/2026-11-04-worker-aa9e83cc
- Reviews: review-1.md PASS
- Cost: worker $0.89, reviews $0.30; review rounds 1

## What went in

- packages/delivery/src/checks-extension.ts: records a `check`/`test`/`mutate` run after leading `NAME=value` assignments and through `bun run <script>`, but not `bun test`; text-only mentions still record nothing.
- packages/delivery/test/checks.test.ts: new test for the assignment and `bun run` forms, the 1800 s timeout on such a call, and refusals of `bun test`, `bun run checkout` and text-only mentions.
- packages/delivery/docs/commands/review-needed.md: the checks paragraph names the forms recorded (assignments, `bun run`) and that `bun test` runs no script.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1479/1550 passed.

## Left open

- Deferred (client summary): F1. an assignment whose value is a command substitution still records nothing
