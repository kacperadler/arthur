# AR0111 - Outcome

- Merged: 2026-10-18, `66fb3d3`
- Branch: h/2026-10-18-ar0111-handover-watchdog-c415e11b
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $6.56, reviews $1.26; review rounds 2

## What went in

- `packages/orchestration/src/inbox-extension.ts`: a watchdog in `tick`: a hand-over omp accepts and loses, or an `agent_end` that says the turn goes on and starts none, goes again after 30 s with omp idle (`QUIET_MS`); never while omp is busy.
- `packages/core/src/fake-agent.ts`, `testing.ts`: the fake agent can lose sends, for the tests.
- `packages/orchestration/test/inbox.test.ts`: a lost hand-over, omp busy past 30 s, and a turn that says it goes on and starts none.
- `test/structure.test.ts`: orchestration budget 697 to 718 (Decision).
- Measured against real omp 18.3.0 by the worker; review 1 FAILed only for a scratch folder left in /tmp, removed before review 2.

## Checks on main

- `npm run check`: passed.
- `npm test`: 392/392 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0122 (F1).
