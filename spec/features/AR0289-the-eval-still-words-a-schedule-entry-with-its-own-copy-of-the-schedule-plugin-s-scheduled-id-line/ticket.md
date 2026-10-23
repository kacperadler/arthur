# AR0289 - The eval still words a schedule entry with its own copy of the schedule plugin's `[scheduled <id>]` line

```json
{
  "id": "AR0289",
  "title": "The eval still words a schedule entry with its own copy of the schedule plugin's `[scheduled <id>]` line",
  "date": "2026-10-22"
}
```

## Description

since AR0277 the eval asks orchestration for the turn (`coordinator.turn`), so the `[Arthur]` mark, the wake and the closing line follow orchestration. The text of a schedule entry's `coordinator-message`, `[scheduled <id>] <message>` with its procedure under a blank line, is still built by develop: a change of that wording in the schedule plugin leaves `{ scheduled, ... }` scenarios replaying the old text, and nothing fails.

## Goal

An eval words a schedule entry by asking the schedule plugin for its `[scheduled <id>]` line, so a scenario's scheduled turn cannot drift from what the coordinator really gets.

- Kind: security

Evidence:
- `packages/develop/src/eval-scenario.ts` (`turnText`, the `coordinator-message` text), copying `packages/schedule/src/sweep.ts:39`
- Found by: 2026-10-22-ar0277-eval-turn-wording-9459b77a (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: the schedule plugin provides the text of an action due (say `schedule.message`, answering `(id, message, procedure text)`), which develop asks instead of its copy; the sweep itself and its late mark stay out.
- `npm test` and `npm run check` pass.

## Scope

In:
- the schedule plugin provides the text of an action due (say `schedule.message`, answering `(id, message, procedure text)`), which develop asks instead of its copy; the sweep itself and its late mark stay out.

## Decisions

- 2026-10-22: Source: F1 of AR0277
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
- 2026-10-22: Coordinator (free hand): line budget raise accepted, schedule 570 to 585, for `schedule.message` and the shared `[scheduled <id>]` text in `sweep.ts`; develop down 667 to 666.
- 2026-10-22: Coordinator (free hand): after merging main (AR0287, develop 669), develop 668 (669 minus this ticket's 1); schedule 585 stays.
