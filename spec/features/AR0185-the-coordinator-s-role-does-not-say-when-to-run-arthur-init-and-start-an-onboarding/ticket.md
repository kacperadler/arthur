# AR0185 - The coordinator's role does not say when to run `arthur init` and start an onboarding

```json
{
  "id": "AR0185",
  "title": "The coordinator's role does not say when to run `arthur init` and start an onboarding",
  "date": "2026-10-19"
}
```

## Description

the coordinator learns of `arthur init` only from `arthur doctor`'s fix line (`fix: arthur init <project>`) and of the onboarding only from `arthur init`'s own output; the procedure `onboarding-ended.md` reaches it only once an onboarding ends. AR0181's Scope is `packages/projects`, so the role is unchanged.

## Goal

The coordinator knows when to run `arthur init` and start an onboarding, so a new repository is taken on without the owner spelling out the steps.

- Kind: feat

Evidence:
- `packages/orchestration/roles/coordinator.md`, "Commands"
- Found by: 2026-10-19-ar0181-onboarding-f9194d6e (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: one line under Commands: a project without a board gets `arthur init <project>`, its files committed, then `arthur spawn --kind onboarding --project <project> 'Onboard <project>.'`; its end brings the procedure (`arthur init --help`). Raise the role's character ceiling in `test/structure.test.ts` if it needs it.
- `npm test` and `npm run check` pass.

## Scope

In:
- one line under Commands: a project without a board gets `arthur init <project>`, its files committed, then `arthur spawn --kind onboarding --project <project> 'Onboard <project>.'`; its end brings the procedure (`arthur init --help`). Raise the role's character ceiling in `test/structure.test.ts` if it needs it.

## Decisions

- 2026-10-19: Source: F3 of AR0181
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
