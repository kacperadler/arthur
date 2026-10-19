# AR0218 - With check.everySeconds above 120 a spawn between rounds still checks a listed machine over ssh itself

```json
{
  "id": "AR0218",
  "title": "With check.everySeconds above 120 a spawn between rounds still checks a listed machine over ssh itself",
  "date": "2026-10-19"
}
```

## Description

a listed machine's free CPU and memory now come with each `machines` round (`machines.round`), but `fresh` still counts a check older than 120 s as stale. With `machines`' `check.everySeconds: 300`, a spawn, placement or `arthur resources` 2 to 5 minutes after a round runs the resources plugin's own `node -e` over ssh to that machine, a second ssh call between rounds.

## Goal

A spawn between machine check rounds uses the round's reading whatever `check.everySeconds` is, so no extra ssh check runs.

- Kind: improvement

Evidence:
- `packages/resources/src/room.ts` (`fresh`, `2 * CHECK_SECONDS`)
- Found by: 2026-10-19-ar0149-resources-pair-f2e0e6b4 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: carry the round's cadence in `machines.round` (or keep it with the sample), so a sample a round kept counts fresh until twice `check.everySeconds`; the on-demand check stays for a missing sample and for processes without rounds (`arthur spawn`, `arthur resources` from a shell). Out: how the room is computed.
- `npm test` and `npm run check` pass.

## Scope

In:
- carry the round's cadence in `machines.round` (or keep it with the sample), so a sample a round kept counts fresh until twice `check.everySeconds`; the on-demand check stays for a missing sample and for processes without rounds (`arthur spawn`, `arthur resources` from a shell). Out: how the room is computed.

## Decisions

- 2026-10-19: Source: F1 of AR0149
- 2026-10-19: Approved under the owner's word of the same day: findings are built in batches.
- 2026-10-19: The owner: finish what is in progress today, on the usage there is now (85%).
