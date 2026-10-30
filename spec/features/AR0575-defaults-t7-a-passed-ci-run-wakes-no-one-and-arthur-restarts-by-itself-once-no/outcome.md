# AR0575 - Outcome

- Merged: 2026-10-30, `7431ebe0`
- Branch: arthur/2026-10-30-worker-1d04e9ab
- Reviews: review-1.md PASS
- Cost: worker $3.00, reviews $0.64; review rounds 1

## What went in

- `packages/github/src/github.ts`: a CI run that ended `success` sends no message to the coordinator; `ci-finished` is still emitted and delivery is still asked; a failure still wakes it.
- `packages/session/src/restart.ts`: the restart tick asks for the restart itself (slot `due`, a 120 s handoff wait) when a restart is due, no job runs, no request is pending and it runs under its service; `due` is settled like `/restart`, so `Restarted.` follows; a failure or a job starting in the wait is logged and tried again, with no notice.
- `packages/session/src/restart-guard.ts`: the context line says Arthur restarts itself once no job runs.
- `packages/orchestration/roles/coordinator.md`: the success half of the CI wake and the restart sentence are gone.
- `packages/github/docs/github.md`, `packages/session/docs/session.md`, `packages/session/docs/commands/restart.md`: say the above.
- `packages/github/test/github.test.ts`, `packages/session/test/restart.test.ts`, `packages/session/test/restart-guard.test.ts`, `packages/orchestration/test/context.test.ts`: tests of each.
- `test/structure.test.ts`: the session line budget 879 to 887 (AR-D355).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1264/1332 passed.

## Left open

- Deferred (client summary): F1. The restart-due check runs git every 500 ms while arthur run idles under its service
- Deferred (client summary): F2. A cancelled or timed-out CI run's wake is untested.
- Deferred (client summary): F3. A due restart that throws on every try gives the coordinator a handoff turn every 500 ms.
