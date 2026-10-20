# AR0226 - Outcome

- Merged: 2026-10-20, `fe8699a`
- Branch: h/2026-10-20-ar0226-outbox-retry-test-ab0e36b7
- Reviews: none
- Cost: worker $2.84, reviews $0.00; review rounds 0

## What went in

- `packages/telegram/test/telegram.test.ts`: the outbox tests (the retry test, "Telegram back while nothing new is sent" from F1 of AR0225, and two more) wait for the fake's send count and an empty outbox, since the fake records a send before the plugin has its answer; the retry gap check is at least 1990 ms. No `src/` change.

## Checks on main

- `npm run check`: passed.
- `npm test`: 777/777 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
