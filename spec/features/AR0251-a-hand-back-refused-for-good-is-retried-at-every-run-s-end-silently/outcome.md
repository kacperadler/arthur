# AR0251 - Outcome

- Merged: 2026-10-21, `076ee29`
- Branch: h/2026-10-21-ar0251-hand-back-refused-9bc04334
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.43, reviews $2.07; review rounds 2

## What went in

- A hand-back step refused by the core or by delivery itself (a ticket dropped, merged, or moved back meanwhile), which no freed slot lifts, ends the hand-back and tells the coordinator once with the reason; other plugins' refusals (`maxAgents`, room) are still retried at each run's end.
- Test kit: `FakeHost.beforeSpawn(check)` refuses as `refused by test`. Budget core/testing 349.

## Checks on main

- `npm run check`: passed.
- `npm test`: 900/900 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
