# AR0116 - Lessons from the predecessor: two worker rules and three roadmap edge cases

```json
{
  "id": "AR0116",
  "title": "Lessons from the predecessor: two worker rules and three roadmap edge cases",
  "date": "2026-10-18"
}
```

## Description

Five fixes recently made to the predecessor harness touch things Arthur has or plans. Two are worker rules Arthur's worker role lacks today; three are edge cases that the roadmap entries for those features should name before they are built.

## Goal

Arthur starts with the lessons its predecessor paid for, instead of finding them again.

- Kind: improvement

## Done means

- `packages/core/roles/worker.md` gains two rules, each one line, with the role's line ceiling test updated if needed:
  - Before the final message, for each condition the change adds (a guard, a refusal, a limit), break it on purpose and check that a test fails, then restore it; a condition no test catches gets a test.
  - Each fact in the final message (a check passed, a count, a behaviour) names the command that showed it.
- `spec/roadmap.md` edge cases added, one line each, in the entries' Done means:
  - 53 (`arthur review-needed`): the default always-review list covers files that read secrets (`.env` loading) and the CI-failure handling.
  - 58 (`arthur ci`): it reads the same run `arthur merge` counts (the newest run that built the branch), not only the run on the tip commit.
  - 59 (auto-merge): when CI ends while the branch waits, the coordinator is woken with the verdict once per run end, also across a restart; a CI run that hangs is cancelled after 30 minutes.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/roles/worker.md`: the two rules.
- `spec/roadmap.md`: the three edge cases.

Out:
- The worktree guard and the job scope: Arthur already guards every project's checkout and starts scopes without the predecessor's probe.
- Any code: the roadmap entries are not built yet.
- macOS-runner specifics (test deadlines, runner label case): Arthur's CI runs on Ubuntu only.

## Decisions

- 2026-10-18: Proposed by the coordinator at the owner's question which predecessor fixes Arthur should carry; waits for approval.
