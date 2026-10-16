# AR0036 - The lock's dead-holder takeover race has no test

```json
{
  "id": "AR0036",
  "title": "The lock's dead-holder takeover race has no test",
  "date": "2026-10-16"
}
```

## Description

`packages/core/src/lock.ts` takes over a lock whose holder is dead, guarded by a `<path>.takeover` file. Two cases were checked by a throwaway script only: several processes racing for a dead holder's lock, and a takeover guard left by a crashed taker. This ticket pins both with tests.

## Goal

The board lock (entry 17) can rely on the lock: concurrent takers of a dead holder's lock and a stuck takeover guard are pinned by a test of real processes. Found by the AR0008 review (F2).

- Kind: risk

## Done means

- A test starts several real Node processes racing for a lock held by a dead pid: exactly one holds it at a time (no overlap in their recorded hold intervals), all finish.
- A test seeds a `.takeover` guard from a dead pid: the next taker recovers and takes the lock.
- Mutation: removing the takeover guard makes the race test fail; said in the result.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/test/lock.test.ts` (and `lock.ts` only if a test exposes a bug).

Out:
- The board lock itself (entry 17).

## Decisions

- 2026-10-16: Source: F2 of AR0008
