# AR0251 - A hand-back refused for good is retried at every run's end, silently

```json
{
  "id": "AR0251",
  "title": "A hand-back refused for good is retried at every run's end, silently",
  "date": "2026-10-21"
}
```

## Description

every `beforeSpawn` refusal keeps the hand-back's step and tries it again at the next `job-ended`, as entry 55 asks for `maxAgents` and the resources plugin's room. A refusal that no freed slot lifts is kept the same way: the core's own check of a worker whose ticket cannot move to in-progress (the owner merged or dropped it meanwhile), or delivery's own review refusals (the ticket moved to planned by hand). The hand-back then waits for ever, retried at each run's end, and the coordinator is never told; only `arthur stopall` ends it, and nothing cancels a single hand-back.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: risk

Evidence:
- `packages/delivery/src/hand-back.ts` (`step`, the `refused by ` test)
- Found by: 2026-10-21-ar0247-roadmap-55-hand-b-835027a0 (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: tell the coordinator once, on a step's first refusal, with the reason (kept in the hand-back's record so it is said once), or end the hand-back on a refusal by `core` or `delivery`, which a freed slot never lifts; leave the retry of other plugins' refusals as it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- tell the coordinator once, on a step's first refusal, with the reason (kept in the hand-back's record so it is said once), or end the hand-back on a refusal by `core` or `delivery`, which a freed slot never lifts; leave the retry of other plugins' refusals as it is.

## Decisions

- 2026-10-21: Source: F1 of AR0247
