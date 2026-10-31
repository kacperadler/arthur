# AR0598 - The Discord gateway test reads the first heartbeat, which may go out before READY with a null sequence

```json
{
  "id": "AR0598",
  "title": "The Discord gateway test reads the first heartbeat, which may go out before READY with a null sequence",
  "date": "2026-10-31"
}
```

## Description

The first test of `packages/discord/test/gateway.test.ts` fails now and then: it asserts that the first heartbeat carries sequence 2, but the first heartbeat goes out after a random jitter of the 50 ms interval, which can be before READY and GUILD_CREATE arrive, so it rightly carries `null`. The test, not the plugin, is wrong; after this ticket it checks a heartbeat sent once both events were seen.

## Goal

Source: CI run 41221156431 (attempt 1) on `arthur/2026-10-31-worker-c2342d8c` at d46fe7e failed in `packages/discord/test/gateway.test.ts:19`: `the heartbeat carries the last sequence: READY 1, GUILD_CREATE 2`, `null !== 2`. The same test passed on main's CI run 41219730146 at 390c9cd, so the failure depends on timing. Discord's gateway docs say the first heartbeat is sent after `heartbeat_interval * jitter`, with `d: null` when no sequence was received yet, so a null first heartbeat is correct behaviour.

- Kind: test

## Done means

- The assertion at `gateway.test.ts:19` waits for (with `until`) and checks a heartbeat sent after GUILD_CREATE, and still fails when the gateway sends a stale or null sequence after READY and GUILD_CREATE (shown by breaking the sequence tracking in `packages/discord/src/gateway.ts` once).
- The test passes 50 times in a row run alone (`node --import @arthur/core/testing --test --test-name-pattern 'identify asks' packages/discord/test/gateway.test.ts` in a loop).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/discord/test/gateway.test.ts`: that one assertion.

Out:
- `packages/discord/src/gateway.ts`: its behaviour is correct and does not change.

## Decisions
