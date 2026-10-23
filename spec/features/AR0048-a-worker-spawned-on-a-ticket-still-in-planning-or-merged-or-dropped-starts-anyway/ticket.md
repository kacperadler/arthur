# AR0048 - A worker spawned on a ticket still in planning, or merged or dropped, starts anyway

```json
{
  "id": "AR0048",
  "title": "A worker spawned on a ticket still in planning, or merged or dropped, starts anyway",
  "date": "2026-10-16"
}
```

## Description

the move to in-progress happens after the job exists, so a ticket the table does not let move (planning, merged, dropped) only gets a line `plugin core: handler of job-started (event N) failed: AC0001: merged cannot move to in-progress; ...` on stderr, and the worker runs on a ticket that was never approved or is already closed (reproduced in `packages/core/test/spawn.test.ts`, the last test).

## Goal

A worker never runs on a ticket that is not approved or is already closed: the spawn refuses before anything is created.

- Kind: feat

Evidence:
- `packages/core/src/host.ts` (the `job-started` handler)
- Found by: 2026-10-16-ar0021-board-transitions-76954a78 (worker), 2026-10-16

## Done means

- A core `beforeSpawn` check refuses a worker whose `Ticket:` cannot move to in-progress (planning, merged, dropped, or unknown on the board), naming the ticket and its status; nothing is created. A ticket already in-progress (a continue) or in review passes.
- The job-started handler then never fails on a status; the old stderr-line test becomes a refusal test.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/host.ts` or `jobs.ts`, `board.ts`, `spawn.test.ts`; `docs/commands/spawn.md`.

## Decisions

- 2026-10-16: Source: F2 of AR0021
