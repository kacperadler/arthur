# AR0070 - An `arthur continue` killed before its wrapper starts leaves `continuing`, and the job is never continued again

```json
{
  "id": "AR0070",
  "title": "An `arthur continue` killed before its wrapper starts leaves `continuing`, and the job is never continued again",
  "date": "2026-10-16",
  "after": [
    "AR0074",
    "AR0078"
  ]
}
```

## Description

`continueJob` creates `<record>/continuing` before it reads the state and removes it in a `finally` when the continue fails; the new wrapper removes it once running. A process ended by a signal skips the `finally`: a Node process waiting in `try { await … } finally { … }` exited 130 on SIGINT without running its `finally` (run on 2026-10-16). So a Ctrl-C, or a SIGKILL, of `arthur continue` while it runs the plugins' `beforeSpawn` checks, waits for the old wrapper (up to 5 seconds), or waits for the new wrapper's `pid` (up to 10 seconds) leaves `continuing`, and every later continue of that job is refused `<id>: being continued` until the folder is removed by hand (said in `packages/core/docs/commands/continue.md`).

## Goal

A killed `arthur continue` never blocks a job forever: its `continuing` folder is recognized as stale and taken over.

- Kind: risk

Evidence:
- `packages/core/src/job-control.ts` (`continueJob`, its `finally`)
- Found by: 2026-10-16-ar0067-one-continue-at-a-52c02319 (worker), 2026-10-16

## Done means

- `continuing` holds the continuing process's pid (and boot id, as the lock does); a continue that finds it held by a dead process takes it over, reusing the takeover in `lock.ts`, not a second implementation.
- A test: a `continuing` left by a dead pid is taken over and the continue runs; one held by a live process is still refused `being continued`.
- `npm test` and `npm run check` pass. No core budget raise: move or cut to fit.

## Scope

In:
- `packages/core/src/job-control.ts`, `lock.ts`, `wrapper.ts`, their tests, `docs/commands/continue.md`.

## Decisions

- 2026-10-16: Source: F1 of AR0067
- 2026-10-16: The human: AR0070, AR0071, AR0076 and AR0079 run today, one after another (shared files); then Arthur pauses.
