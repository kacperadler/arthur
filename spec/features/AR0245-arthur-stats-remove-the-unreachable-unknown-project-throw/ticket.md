# AR0245 - arthur stats: remove the unreachable unknown-project throw

```json
{
  "id": "AR0245",
  "title": "arthur stats: remove the unreachable unknown-project throw",
  "date": "2026-10-21"
}
```

## Description

`packages/manage/src/stats.ts:73-75`: the `where` lookup and its `throw new Error("unknown project …")` never run, since `host.board.list(project)` on line 71 already refuses an unknown project with its own message.

## Goal

The dead lookup and throw are gone; an unknown project still gets the board's refusal.

- Kind: cleanup

## Done means

- Lines 73-75 removed; the existing unknown-project test still passes; manage budget lowered by the lines cut.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/manage/src/stats.ts`, `test/structure.test.ts`.

## Decisions

- 2026-10-21: Source: review-1 note of AR0244
