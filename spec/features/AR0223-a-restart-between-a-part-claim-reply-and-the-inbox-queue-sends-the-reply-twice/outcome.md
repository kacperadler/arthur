# AR0223 - Outcome

- Merged: 2026-10-20, `7f2c3b9`
- Branch: h/2026-10-20-ar0223-claim-reply-sent-ec2362fc
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.86, reviews $1.02; review rounds 2

## What went in

- `packages/orchestration/src/inbox.ts`: before resolving a message's parts again, the inbox reads the event log from that message's event and reuses the claims' replies already logged for it, in order, so a restart sends each reply once; a hand-cut log, whose event times do not match, reuses nothing.
- `packages/orchestration/test/inbox.test.ts`: a restart held in a claim after the first reply, and a message left from before a hand-cut log.
- `packages/orchestration/docs/commands/coordinator.md`: one sentence on it; `test/structure.test.ts`: orchestration budget 1433.

## Checks on main

- `npm run check`: passed.
- `npm test`: 769/769 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: F1 dropped (needs a broken invariant).
