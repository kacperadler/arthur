# AR0085 - A continue killed between its new wrapper's `pid` and `state` lets a second continue start beside the running wrapper

```json
{
  "id": "AR0085",
  "title": "A continue killed between its new wrapper's `pid` and `state` lets a second continue start beside the running wrapper",
  "date": "2026-10-16",
  "after": [
    "AR0081"
  ]
}
```

## Description

the new wrapper writes `pid`, then `state` (`running`), then removes `continuing`. `continueJob` now waits after `launch` until the state says `running` (or the wrapper is gone) before its process ends, so a continue that ends normally never leaves its lock to be taken over while the record still shows the old final state. A continue killed (SIGKILL, Ctrl-C) inside the moment between the wrapper's two writes still does: the next continue takes the dead holder's `continuing` over, reads the old final state, waits up to 5 seconds for the new wrapper (which keeps running), removes its `pid` and launches a second wrapper in the scope of the same name. [INFERENCE, not run: the window is the time between two synchronous renames] `systemd-run` then refuses the scope and `launch` writes `failed` over the job the first wrapper is running.

## Goal


Two wrappers never run for one job, however a continue is killed.

- Kind: security

Evidence:
- `packages/core/src/wrapper.ts:94-96`, `packages/core/src/job-control.ts` (`continueJob`)
- Found by: 2026-10-16-ar0070-continue-killed-b-771a00d8 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: let the wrapper write `state` before `pid` only if the dead-job sweep in `job-records.ts` (which ends a `running` record whose wrapper pid is not running) tolerates a moment without `pid`; or let a continue that took `continuing` over refuse when `pid` names a live wrapper of the job newer than the record's `continue`. Out: anything beyond `continueJob`, `wrapper.ts` and the sweep.
- `npm test` and `npm run check` pass.

## Scope

In:
- let the wrapper write `state` before `pid` only if the dead-job sweep in `job-records.ts` (which ends a `running` record whose wrapper pid is not running) tolerates a moment without `pid`; or let a continue that took `continuing` over refuse when `pid` names a live wrapper of the job newer than the record's `continue`. Out: anything beyond `continueJob`, `wrapper.ts` and the sweep.

## Decisions

- 2026-10-16: Source: F1 of AR0070
- 2026-10-17: The owner approved it for the overnight run of six tickets (AR0107, AR0084, AR0081, AR0085, AR0110, AR0098), done in order and merged after PASS and green GitHub CI.
