# AR0155 - Two `--autopilot` runs on one ticket at once can both record it

```json
{
  "id": "AR0155",
  "title": "Two `--autopilot` runs on one ticket at once can both record it",
  "date": "2026-10-18"
}
```

## Description

the status check, the write of the `Pre-approved by policy` line and the move are not one step under the board's lock: two processes running `arthur ticket status <id> planned --autopilot` at the same moment both see `planning`, both append a line, and the second move is a move to the same status. The ticket ends planned with two records. One coordinator runs its commands one after another, so it needs two writers [INFERENCE: not reproduced].

## Goal

Two pre-approvals of one ticket at the same moment record it once.

- Kind: bug

Evidence:
- `packages/orchestration/src/autopilot.ts`
- Found by: 2026-10-18-ar0140-d850a4c7 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: take a lock per ticket (a file created with `wx` in the board's `spec/.board/`) around check, write and move, or let `host.board.move` take a change of the ticket's text that it writes under its own lock.
- `npm test` and `npm run check` pass.

## Scope

In:
- take a lock per ticket (a file created with `wx` in the board's `spec/.board/`) around check, write and move, or let `host.board.move` take a change of the ticket's text that it writes under its own lock.

## Decisions

- 2026-10-18: Source: F2 of AR0140
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
