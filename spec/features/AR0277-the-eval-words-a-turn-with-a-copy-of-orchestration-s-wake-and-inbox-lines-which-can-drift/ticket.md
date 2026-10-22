# AR0277 - The eval words a turn with a copy of orchestration's wake and inbox lines, which can drift

```json
{
  "id": "AR0277",
  "title": "The eval words a turn with a copy of orchestration's wake and inbox lines, which can drift",
  "date": "2026-10-22"
}
```

## Description

develop may not import orchestration, and no provided name gives the text the inbox hands the coordinator for an event, so `arthur eval` builds the turn with its own copy of that wording. A change to the wake's or the inbox's wording in orchestration leaves the evals replaying the old text, and nothing fails.

## Goal

Evals replay the very text the live coordinator gets: when orchestration's wake or inbox wording changes, the evals follow it instead of silently testing the old wording. Moves the vision's develop direction: evals that measure the coordinator as it really runs.

- Kind: risk

Evidence:
- `packages/develop/src/eval-scenario.ts` (`turnText`), copying `packages/orchestration/src/inbox.ts` (`wake`) and `packages/orchestration/src/inbox-extension.ts` (the `[Arthur]` / `[via <channel>]` marks and the `ARTHUR` line)
- Found by: 2026-10-22-ar0276-evals-runner-eda48620 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: orchestration provides a name (say `coordinator.turn`) answering `(event name, data, result)` with the text its inbox would queue for it, the wake with the plugins' `coordinator.wake` lines included; develop asks it and drops its copy. Out: the inbox's queueing itself.
- `npm test` and `npm run check` pass.

## Scope

In:
- orchestration provides a name (say `coordinator.turn`) answering `(event name, data, result)` with the text its inbox would queue for it, the wake with the plugins' `coordinator.wake` lines included; develop asks it and drops its copy. Out: the inbox's queueing itself.

## Decisions

- 2026-10-22: Source: F1 of AR0276
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
- 2026-10-22: Coordinator (free hand) accepted orchestration budget 1991 -> 2020 (coordinator.turn, hand-over.ts).
