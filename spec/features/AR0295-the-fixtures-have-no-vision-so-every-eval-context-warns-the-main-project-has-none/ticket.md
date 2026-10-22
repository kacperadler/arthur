# AR0295 - The fixtures have no vision, so every eval context warns the main project has none

```json
{
  "id": "AR0295",
  "title": "The fixtures have no vision, so every eval context warns the main project has none",
  "date": "2026-10-22"
}
```

## Description

the context of a fixture's copy reads the vision at the main project's `prompts.vision` in the copy; no fixture has one, so each turn's context says `- project arthur has no vision: spec/vision.md is missing; the coordinator goes without it` (seen in a smoke run of `orchestration/night-one-line` and `orchestration/morning-report`), naming the main project while the fixture is the shop, which the live coordinator never sees.

## Goal

Each eval fixture has a vision (or the context stops warning when a copy has none), so no eval turn carries a false 'the main project has no vision' warning.

- Kind: improvement

Evidence:
- `packages/*/evals/*/fixture/` (no `spec/vision.md`)
- Found by: 2026-10-22-ar0279-ba46bace (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: a short `spec/vision.md` of the shop in each fixture (or one the runner copies in when the fixture has none); the heading then names the main project, `## Vision of arthur`, which could name nothing for a checkout.
- `npm test` and `npm run check` pass.

## Scope

In:
- a short `spec/vision.md` of the shop in each fixture (or one the runner copies in when the fixture has none); the heading then names the main project, `## Vision of arthur`, which could name nothing for a checkout.

## Decisions

- 2026-10-22: Source: F2 of AR0279
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
