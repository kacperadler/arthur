# AR0688 - A plan worker starts on a recorded no, and a no recorded as option 1 still passes, since only the decided line is read

```json
{
  "id": "AR0688",
  "title": "A plan worker starts on a recorded no, and a no recorded as option 1 still passes, since only the decided line is read",
  "date": "2026-11-10"
}
```

## Description

AR0677 made plan and merge approvals count only when the owner's answer picked option 1. Two gaps remain from its findings: the spawn check of a planned ticket's worker still reads only the decided line, and nothing ties option 1 to the approval wording, nor shows the owner which option was recorded.

## Goal

Evidence, AR0677 findings (`spec/features/AR0677-.../findings.md`):
- F1 (security): `packages/orchestration/src/plans.ts:84-88`, `proved` in the `unplanned` spawn check, counts an approval when `--decided` reads `Plan approved by the owner: plan.md at <commit>`, whatever `--picked` says; an answer with `--picked 2` or no pick still lets the worker start, while `arthur ticket status <id> planned --decision <id>` refuses it.
- F3 (fix): `packages/orchestration/src/decision-use.ts:53` takes option 1 as the approval by convention; an ask with `--option 'Not yet' --option 'Merge it'` lets a no be recorded as `--picked 1`. The owner's notice (`decision-writes.ts:66`) does not show the option picked.

- Kind: security

## Done means

- A `- Plan: yes` ticket's worker spawn is refused when its plan decision's answer did not pick option 1 (no pick, `--picked 2`); a row each in `plans.test.ts` fails before and passes after.
- A plan or merge ask whose option 1 does not read as an approval is refused, or the owner's notice names the picked option's text; the planner picks the smaller of the two and a test proves it.
- The project's checks pass.

## Scope

In:
- `packages/orchestration/src/plans.ts` and its test: `proved` requires `picked === 1`.
- `packages/orchestration/src/decision-use.ts`, `decision-writes.ts` and their tests: option 1 or the notice.

Out:
- The merge evals' missing round trip (AR0677 F2).
- The Decisions line's format.

## Decisions
- 2026-11-10: AR0688 approved; build it next in line; the owner: "AR-D629: 1" (AR-D629)

