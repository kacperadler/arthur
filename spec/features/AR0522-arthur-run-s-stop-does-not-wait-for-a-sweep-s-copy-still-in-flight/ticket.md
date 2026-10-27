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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: fix

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F3 of AR0509
