# AR0306 - The agent's extensions still append to `log` with a flag that creates it

```json
{
  "id": "AR0306",
  "title": "The agent's extensions still append to `log` with a flag that creates it",
  "date": "2026-10-23"
}
```

## Description

AR0300 makes the wrapper append to `log` without creating it, but the steer extension (a steer delivered at a `tool_result`) and the worktree guard (its once-per-job fallback line) run in the agent's process and append with `appendFileSync`'s default flag `a`, which creates `log`; one that lands while a `rm -r` of the record is emptying it, after `log` was unlinked, leaves a new `log` and the `rm -r` fails with `ENOTEMPTY`. [INFERENCE: read from the lines; not reproduced.]

## Goal

The agent's extensions (`steer.ts`, `worktree-guard.ts`) append to `log` without creating it, like the wrapper since AR0300, so no writer recreates `log` in a record being removed.

- Kind: fix

Evidence:
- `packages/core/src/steer.ts:29`, `packages/core/src/worktree-guard.ts:170`
- Found by: 2026-10-22-ar0300-f1036105 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: append there with `{ flag: constants.O_WRONLY | constants.O_APPEND }` as `wrapper.ts` does and skip the line on `ENOENT` (the wrapper ends the job at its next use); out: any retry of the append.
- `npm test` and `npm run check` pass.

## Scope

In:
- append there with `{ flag: constants.O_WRONLY | constants.O_APPEND }` as `wrapper.ts` does and skip the line on `ENOENT` (the wrapper ends the job at its next use); out: any retry of the append.

## Decisions

- 2026-10-23: Source: F1 of AR0300
- 2026-10-23: Coordinator (free hand, finding ticket) approved.
- 2026-10-23: Coordinator (free hand): line budget raise accepted, core 5755 to 5770, for appending the steer and worktree-guard log lines without creating `log`.
- 2026-10-23: Coordinator (free hand): after merging main (AR0305, core 5772), core 5787 (5772 + this ticket's 15).
