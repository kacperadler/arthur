# AR0598 - Outcome

- Merged: 2026-11-01, `8bdec3cf`
- Branch: arthur/2026-10-31-worker-95fff6d4
- Reviews: review-1.md PASS
- Cost: worker $1.10, reviews $0.25; review rounds 1

## What went in

- packages/discord/test/gateway.test.ts: the first test checks the sequence on the third heartbeat, sent two intervals after the random first one and after READY and GUILD_CREATE, so a first heartbeat that correctly carries `null` before READY no longer fails it.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1384/1453 passed.

## Left open

- Deferred (client summary): F1. the test can still fail under heavy load
