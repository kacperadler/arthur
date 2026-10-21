# AR0259 - The example config gives delivery an option it refuses

```json
{
  "id": "AR0259",
  "title": "The example config gives delivery an option it refuses",
  "date": "2026-10-21"
}
```

## Description

the example gives `delivery({ ..., merge: { afterPassAndGreenCi: true } })`; delivery's `checkOptions` answers `merge: unknown option; options: review` (the test "the options: only review.alwaysReview" asserts that answer), so a config copied from the example refuses the load. Auto-merge is the project's `autoMerge` instead. Its `review.alwaysReview` there also lacks `**/github-ci.ts` and `**/auto-merge.ts`, which the default list now holds (its `**/merge*.ts` covers merge-command.ts).

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: bug

Evidence:
- `arthur.config.example.ts:338-339`
- Found by: 2026-10-21-ar0253-roadmap-59-auto-m-df78fc6b (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: drop the `merge` line, and add the two patterns to the example's list; nothing else.
- `npm test` and `npm run check` pass.

## Scope

In:
- drop the `merge` line, and add the two patterns to the example's list; nothing else.

## Decisions

- 2026-10-21: Source: F3 of AR0253
