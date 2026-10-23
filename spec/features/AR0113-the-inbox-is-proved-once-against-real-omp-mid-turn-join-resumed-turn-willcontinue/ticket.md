# AR0113 - The inbox is proved once against real omp: mid-turn join, resumed turn, willContinue

```json
{
  "id": "AR0113",
  "title": "The inbox is proved once against real omp: mid-turn join, resumed turn, willContinue",
  "date": "2026-10-17"
}
```

## Description

AR0084's inbox is tested only against the fake agent. Three behaviours rest on omp itself and were never run: a human's message joining after the next tool call, a message after the reply resuming the turn through `session_stop`, and `agent_end.willContinue`.

## Goal

The owner's mid-turn messages are answered by the real coordinator, not only by the fake one.

- Kind: security

Evidence:
- AR0084 plan.md, How to test (the live smoke); findings F3 of AR0084.
- Found by: 2026-10-17-review-ar0084-inbox-c6203af6 (review), 2026-10-17

## Done means

- The plan's live smoke run once with real omp and a model key, its transcript in `outcome.md`: each of the three behaviours seen, or the gap it shows fixed with a test against the fake agent.
- The `ctx.hasUI` guard checked: an omp `task` subagent of the coordinator does not take the inbox.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/orchestration/src/inbox-extension.ts` only if the smoke shows a gap.

Out:
- F1 and F2 of AR0084 (AR0111, AR0112).

## Decisions

- 2026-10-17: Source: F3 of AR0084
- 2026-10-18: The owner approved it.
- 2026-10-18: The smoke transcript is in `smoke.md` (moved from `outcome.md`, which `h merge` writes).
