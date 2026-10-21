# AR0258 - The coordinator's role names merges only on the owner's word

```json
{
  "id": "AR0258",
  "title": "The coordinator's role names merges only on the owner's word",
  "date": "2026-10-21"
}
```

## Description

the role says `When the owner asks for a merge: arthur merge <job>`; `arthur merge --auto` is told to the coordinator only by delivery's wakes (a PASS in a project with `autoMerge` on, and a waiting branch's CI end). A coordinator that reads its role as the only rule for merges may wait for the owner anyway.

## Goal

The coordinator's role names `arthur merge --auto` next to the owner's merge, so the coordinator acts on delivery's wakes instead of waiting for the owner.
- Kind: improvement

Evidence:
- `packages/orchestration/roles/coordinator.md:25`
- Found by: 2026-10-21-ar0253-roadmap-59-auto-m-df78fc6b (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: one line in that bullet: in a project with `autoMerge` on, after a PASS the wake names `arthur merge --auto <job>`; a refusal that says `it waits` needs nothing until CI's wake. Out of AR0253's Scope (orchestration), so left here.
- `npm test` and `npm run check` pass.

## Scope

In:
- one line in that bullet: in a project with `autoMerge` on, after a PASS the wake names `arthur merge --auto <job>`; a refusal that says `it waits` needs nothing until CI's wake. Out of AR0253's Scope (orchestration), so left here.

## Decisions

- 2026-10-21: Source: F2 of AR0253
- 2026-10-21: Approved by the owner (Telegram).
