# AR0293 - Outcome

- Merged: 2026-10-22, `fbf9607`
- Branch: h/2026-10-22-ar0293-de392dd4
- Reviews: review-1.md PASS
- Cost: worker $2.66, reviews $0.90; review rounds 1

## What went in

- `packages/orchestration/test/inbox.test.ts`: the lost hand-over, the turn that goes on and the compaction tests run on `agentClock()`, a clock file the test moves, and `box.ticked()`; each takes about 4 s instead of over 30 s and no longer overshoots under load.
- `packages/core/src/fake-agent.ts`: `compactMs` counts against `Date.now()`, so a test's clock moves it; each `agent_end` goes to `ends.jsonl`. core/testing stays 349.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1031/1031 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0302 (F1).
