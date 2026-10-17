# AR0114 - README's orchestration row shows entries 24 and 26 as not built

```json
{
  "id": "AR0114",
  "title": "README's orchestration row shows entries 24 and 26 as not built",
  "date": "2026-10-17"
}
```

## Description

The README's status table still says orchestration has "1 of 8 entries" with "24 to 29, 65" to come, though AR0084 (entry 24) and AR0110 (entry 26) are merged. A newcomer reads a wrong picture of what works.

## Goal

The README tells a newcomer what is built today.

- Kind: cleanup
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
