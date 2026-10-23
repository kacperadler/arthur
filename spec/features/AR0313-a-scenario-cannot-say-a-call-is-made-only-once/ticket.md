# AR0313 - A scenario cannot say a call is made only once

```json
{
  "id": "AR0313",
  "title": "A scenario cannot say a call is made only once",
  "date": "2026-10-23"
}
```

## Description

`expect.calls` asks that each regex match some call, in order, and `never` that none does; neither counts. AR0308's Done means ask for one `arthur continue` call in `delivery/check-failed`; the scenario holds at least one, and a turn that continues the worker twice still passes.

## Goal

A scenario can require that a call is made exactly once (a count on an `expect.calls` entry), and delivery/check-failed requires one `arthur continue`, so a coordinator that continues twice fails the eval.

- Kind: improvement

Evidence:
- `packages/develop/src/eval-scenario.ts:15`
- Found by: 2026-10-23-ar0308-continue-after-ch-f18c2f31 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: an optional count per call (or `once`), scored as `calls` is; out: any change to the stub's answers.
- `npm test` and `npm run check` pass.

## Scope

In:
- an optional count per call (or `once`), scored as `calls` is; out: any change to the stub's answers.

## Decisions

- 2026-10-23: Source: F2 of AR0308
- 2026-10-23: Coordinator (free hand, finding ticket) approved.
