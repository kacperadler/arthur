# AR0114 - README's orchestration row shows entries 24 and 26 as not built

```json
{
  "id": "AR0114",
  "title": "README's orchestration row shows entries 24 and 26 as not built",
  "date": "2026-10-17",
  "after": [
    "AR0115"
  ]
}
```

## Description

The README's status table still says orchestration has "1 of 8 entries" with "24 to 29, 65" to come, though AR0084 (entry 24) and AR0110 (entry 26) are merged. A newcomer reads a wrong picture of what works.

## Goal

The README tells a newcomer what is built today.

- Kind: refactor
- Model: haiku

Evidence:
- `README.md`, the orchestration row; `arthur.mmd` if it shows the same.
- Found by: 2026-10-17-review-ar0110-maxagents-c16142a8 (review), 2026-10-17

## Done means

- The orchestration row in `README.md` (and its box in `arthur.mmd`, if it lists entries) counts entries 23, 24 and 26 as built and lists 25, 27 to 29 and 65 as to come.
- `npm test` and `npm run check` pass.

## Scope

In:
- `README.md`, `arthur.mmd`.

Out:
- Any other row.

## Decisions

- 2026-10-17: Source: F2 of AR0110
- 2026-10-18: The owner approved it.
- 2026-10-18: Runs after AR0115, which edits the same README row; do only what AR0115 left undone.
- 2026-10-18: AR0115 fixed the feature table row; this ticket now does F1 of AR0115 instead: rewrite the README "What works today" and "What is next" lists (README.md:33-40) from spec/build.json, with an agent per project (entries 85 to 88) first among the later plugins as the roadmap orders it.
