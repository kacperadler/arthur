# AR0626 - Outcome

- Merged: 2026-11-05, `be1b4929`
- Branch: arthur/2026-11-05-worker-bb65dcfc
- Reviews: review-1.md PASS
- Cost: worker $2.89, reviews $0.26; review rounds 1

## What went in

- `packages/discord/test/discord.test.ts`: the refused-slice test waits until the plugin has started reading the main channel's recent messages before it creates the "gone" channel, so the first stderr line is always the refused POST.
- `packages/discord/test/menu.test.ts`: the empty-menu test waits for `commands.json` to be written before it stops the plugin.
- `packages/models/test/models.test.ts`: the unreachable provider points at `http://127.0.0.1:9` instead of a closed server's freed port.
- `packages/core/test/job-control.test.ts`: a `reap(t, file)` helper kills, at each test's end, the `sleep 300` whose pid the test noted. Every test there that starts one uses it, and the two that left one behind now note its pid.
- `packages/core/test/scope.test.ts`: the "wrapper writes no pid within 10 s" test kills its fake `systemd-run`'s `sleep 300` at its end, pass or fail.
- `packages/delivery/test/merge.test.ts`: `forkingTest` sets up the kill of its sleeper before the merge, so a merge that throws no longer leaves it running.
- `spec/features/AR0626-two-tests-fail-now-and-then-under-the-full-suite-models-server-unreachable/findings.md`: F1, the gateway test that failed once with its 50 ms heartbeat.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1479/1550 passed.

## Left open

- Deferred (client summary): F1. The discord gateway's first test fails now and then under the full suite: a 50 ms heartbeat
- Deferred (client summary): F2. the 50 ms heartbeat flakes under load (F1, outside this range)
