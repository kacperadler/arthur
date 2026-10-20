# AR0230 - Two comments still name what AR0228 changed

```json
{
  "id": "AR0230",
  "title": "Two comments still name what AR0228 changed",
  "date": "2026-10-20"
}
```

## Description

Two code comments describe the code as it was before AR0228 froze the host API. A reader of either is misled.

## Goal

Each comment says what the code does now.

- Kind: cleanup
- Model: haiku

## Done means

- `packages/core/src/wrapper.ts:62`: the comment "a job a plugin holds is `blocked` until `unblock`" says instead that a held job stays `blocked` until its run ends (`unblock` was removed in AR0228).
- `test/structure.test.ts`: the AR0228 comment above `BUDGETS` lists additions and cuts whose net equals the core's raise, +16 (5668 to 5684); today they sum to +17. Recount with `git show 2e73ad8 --stat` and the comment's own items; change only the numbers that are wrong.
- No code line changes. `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/wrapper.ts` (one comment), `test/structure.test.ts` (one comment).

Out:
- Any code or budget value.

## Decisions

- 2026-10-20: Source: F2 of AR0228
- 2026-10-20: Source: F3 of AR0228
- 2026-10-20: Approved by the coordinator under the owner's free hand in Arthur.
