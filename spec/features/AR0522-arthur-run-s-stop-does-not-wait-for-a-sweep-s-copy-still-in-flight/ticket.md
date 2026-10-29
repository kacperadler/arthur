# AR0522 - `arthur run`'s stop does not wait for a sweep's copy still in flight

```json
{
  "id": "AR0522",
  "title": "`arthur run`'s stop does not wait for a sweep's copy still in flight",
  "date": "2026-10-27"
}
```

## Description

F3 of AR0509 (spec/features/AR0509-the-sweep-s-copy-from-another-machine-has-no-size-or-time-bound-so-one-machine/findings.md).

- Kind: fix
- Found by: 2026-10-27-worker-61d50fad (worker), 2026-10-27
- Where: `packages/core/src/run.ts:50` (`setInterval(() => Promise.try(sweep)...)`), `:89-90` (`clearInterval`, then `lock.release()`)
- What: the copy is now asynchronous (AR0509), up to 20 s per machine. A SIGTERM during one clears the interval and releases `run.pid` while that copy still runs; it writes records after the lock is gone, possibly beside a new `arthur run`'s first sweep. The copy's check of `synced` before it writes (`machine-sync.ts:58`) keeps a log from being appended twice, but the two may still move one job's state each. [INFERENCE: from the code; not run.]
- Suggestion: keep the sweep's promise in `runPlugins` and await it before the lock is released. Out: the copy itself.

## Goal

`arthur run`'s stop releases `run.pid` while a sweep's copy from another machine may still run (`packages/core/src/run.ts:50`, `:89-90`), so that copy can write job records after the lock is gone, beside a new `arthur run`'s first sweep.

- Kind: fix

## Done means

- The stop waits for the sweep in flight, if any, before it releases `run.pid`; a test with a copy held open shows the lock still held until the copy ends, and released right after.
- A stop with no sweep in flight is as quick as today (a test).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/run.ts`: keep the sweep's promise and await it before the lock is released.
- Its test.

Out:
- The copy itself (AR0509), its size and time bounds.

## Decisions

- 2026-10-27: Source: F3 of AR0509
- 2026-10-29: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
