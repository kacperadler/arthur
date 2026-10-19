# AR0183 - `arthur merge` (54) must ask `merge.check` before it merges an onboarding's branch

```json
{
  "id": "AR0183",
  "title": "`arthur merge` (54) must ask `merge.check` before it merges an onboarding's branch",
  "date": "2026-10-19"
}
```

## Description

entry 42 says an onboarding's merge accepts only the vision and criteria files. Arthur has no merge yet (the README: "nothing reviews or merges"), and entry 54 is out of AR0181's Scope, so the projects plugin provides the rule as `merge.check` (asked with the job as `host.jobs.list()` has it; a text is a reason to refuse), tested against real branches in `packages/projects/test/onboarding.test.ts`. Nothing asks it until 54 exists; until then the onboarding procedure has the coordinator show the owner `git diff --stat HEAD...arthur/<job id>` before a merge.

## Goal

An onboarding's draft can never change files other than the vision and the criteria: `arthur merge` refuses it through `merge.check`.

- Kind: improvement

Evidence:
- `packages/projects/src/onboarding.ts` (`host.provide("merge.check", ...)`)
- Found by: 2026-10-19-ar0181-onboarding-f9194d6e (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: in entry 54, before `git merge`, `collect("merge.check", job)` and refuse with every text answer, main unchanged; a test with a fake plugin that provides `merge.check`. Out: changing the rule itself.
- `npm test` and `npm run check` pass.

## Scope

In:
- in entry 54, before `git merge`, `collect("merge.check", job)` and refuse with every text answer, main unchanged; a test with a fake plugin that provides `merge.check`. Out: changing the rule itself.

## Decisions

- 2026-10-19: Source: F1 of AR0181
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
