# AR0693 - A role, criteria or vision file the approved ticket's Scope names merges on its own after CI passes

```json
{
  "id": "AR0693",
  "title": "A role, criteria or vision file the approved ticket's Scope names merges on its own after CI passes",
  "date": "2026-11-11"
}
```

## Description

An approved ticket whose Scope names a role file, a criteria file or the vision merges on its own after a PASS and green CI, as any other approved ticket does under AR-D622. CI workflows, `package.json`, lockfiles and the rules on the owner's merge words stay held.

## Goal

The owner said (AR-D622): "If ticket is approved and CI is green merge it and do not ask me about it". Yet 7 of the 9 merge questions since then waited only because the branch changed a role, a criteria file or the vision: AR-D626 (AR0677), AR-D630 (AR0680), AR-D637 (AR0681), AR-D644 (AR0687), AR-D647 (AR0682), AR-D631 (AR0676), AR-D646 (AR0689). He agreed with the merge recommendation 61 of 61 times. Retro 2026-11-11, proposal 1.

- Kind: chore

## Done means

- `arthur merge --auto` merges a branch whose changed role, criteria or vision file is named in backticks in its ticket's `## Scope` before `Out:` (read from main's ticket.md), and still refuses one it does not name, naming the file.
- CI workflows, `package.json`, lockfiles and every other always-review path still refuse `--auto` whatever the Scope names.
- Tests in `packages/delivery/test/` for: a named role file merges; an unnamed role file is refused; a named workflow file is still refused; a path named only under `Out:` is refused. Each fails before the change.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/auto-merge.ts`: `autoRefusal`'s held-path loop skips a role, criteria or vision path the ticket's Scope names.
- `packages/delivery/test/`: the tests above.
- `packages/delivery/docs/`: the `--auto` held-path paragraph of the merge doc.

Out:
- The rules on the owner's merge words (AR0664, AR0688) and plan approval (AR-D603): unchanged.
- Ticket Scopes naming their role files is the coordinator's and planner's habit, not this code.

## Decisions

- 2026-11-11: Source: retro spec/retro/2026-11-11.md
- 2026-11-11: AR0693 approved; the owner: "AR-D649 1, AR-D650 1, AR-D651 1, AR-D652 1, AR-D653 1" (AR-D649)
