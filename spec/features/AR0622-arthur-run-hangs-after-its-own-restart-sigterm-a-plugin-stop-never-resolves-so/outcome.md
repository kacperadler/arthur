# AR0622 - Outcome

- Merged: 2026-11-04, `feac705f`
- Branch: arthur/2026-11-04-worker-e10a52d3
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $5.30, reviews $1.05; review rounds 2

## What went in

- `packages/core/src/run.ts`: limits each plugin's `stop` to 30 s; a stop still running then is named on stderr, the other plugins still stop, and the exit code is 1.
- `packages/core/src/cli.ts`: `arthur run` exits one second after its stops even when a stop left a socket or timer holding the process.
- `packages/core/test/run.test.ts`: tests the 30 s bound after a SIGTERM (plugin named, the others stopped, exit 1 from the timeout alone, on mocked time) and the exit despite a lingering timer (spawned CLI).
- `packages/core/docs/commands/run.md`: documents the 30 s stop bound, its log line, exit code 1 and the exit one second after `stopped`.
- `packages/discord/src/gateway.ts`: a close the gateway does not answer within 5 s counts as 1006, so a stop ends and a heartbeat close resumes.
- `packages/discord/docs/discord.md`: "Receiving" says an unanswered close counts as lost after 5 s.
- `packages/discord/test/fake-discord.ts`: a `deaf` mode where the fake gateway answers no close frame and keeps TCP open; upgraded sockets are destroyed at teardown.
- `packages/discord/test/gateway.test.ts`: tests that a deaf gateway's heartbeat close resumes after 5 s and that a stop on it ends.
- `packages/orchestration/src/coordinator.ts`: the supervisor stops its loop on `arthur run`'s SIGTERM or SIGINT, so no coordinator is started again; `stop` removes the listeners.
- `packages/orchestration/test/coordinator.test.ts`: tests that from SIGTERM or SIGINT on no further start is made and that `stop` leaves the listener counts as found.
- `packages/orchestration/docs/commands/coordinator.md`: step 2 says the coordinator is not started again once `arthur run` is stopping.
- `test/structure.test.ts`: line budgets core 7210, discord 976, orchestration 2745.
- `spec/features/AR0622-arthur-run-hangs-after-its-own-restart-sigterm-a-plugin-stop-never-resolves-so/findings.md`: new, with F1 (the socket left open after an unanswered gateway close).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1470/1541 passed.

## Left open

- Deferred (client summary): F1. A Discord gateway close its peer never answers leaves its TCP socket open
- Deferred (client summary): F2. The plugin listens for SIGTERM and SIGINT on the process directly, not through the host
