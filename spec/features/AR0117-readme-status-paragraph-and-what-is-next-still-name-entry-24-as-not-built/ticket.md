# AR0117 - README "Status" paragraph and "What is next" still name entry 24 as not built

```json
{
  "id": "AR0117",
  "title": "README \"Status\" paragraph and \"What is next\" still name entry 24 as not built",
  "date": "2026-10-18"
}
```

## Description

the "What works today" and "What is next" lists say entry 24 (the coordinator's inbox) is next and that entries 25 to 29 and 65 follow with "an agent per project" after them. `spec/build.json` has AR0084 (entry 24) and AR0110 (entry 26) merged. The status line (`README.md:29`) and the feature table's heading also still say "main on 2026-10-17".

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: refactor

Evidence:
- `README.md:33-40`
- Found by: 2026-10-18-ar0115-diagram-counts-c17863d0 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: rewrite those two lists from `spec/build.json`, and move "an agent per project" (entries 85 to 88) ahead of the other later plugins as the roadmap now orders it. Out of this ticket's Scope; AR0114 covers only the feature table row.
- `npm test` and `npm run check` pass.

## Scope

In:
- rewrite those two lists from `spec/build.json`, and move "an agent per project" (entries 85 to 88) ahead of the other later plugins as the roadmap now orders it. Out of this ticket's Scope; AR0114 covers only the feature table row.

## Decisions

- 2026-10-18: Source: F1 of AR0115
- 2026-10-18: Dropped: duplicate of AR0114, which the coordinator gave F1 of AR0115 before the merge.
