# AR0200 - The example's Conventional Commits regex allows subjects over 72 characters

```json
{
  "id": "AR0200",
  "title": "The example's Conventional Commits regex allows subjects over 72 characters",
  "date": "2026-10-19"
}
```

## Description

`^(feat|...)(\([\w-]+\))?!?: .{1,72}$` counts 72 after the `type(scope): ` prefix, so a subject of up to about 90 characters passes, while the worker role of this repository says a subject is at most 72. Of the last 200 non-merge subjects on this branch all match it and 5 are over 72 (`git log --format=%s -200 --no-merges`).

## Goal

The example's Conventional Commits regex refuses a subject over 72 characters, as the rule it shows says.

- Kind: feat

Evidence:
- `arthur.config.example.ts:235`
- Found by: 2026-10-19-ar0188-commit-rules-3a76b3d2 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: `^(?=.{1,72}$)(feat|fix|refactor|perf|test|docs|build|ci|chore|revert)(\([\w-]+\))?!?: .+$`, if the owner wants the 72 to be the whole subject.
- `npm test` and `npm run check` pass.

## Scope

In:
- `^(?=.{1,72}$)(feat|fix|refactor|perf|test|docs|build|ci|chore|revert)(\([\w-]+\))?!?: .+$`, if the owner wants the 72 to be the whole subject.

## Decisions

- 2026-10-19: Source: F3 of AR0188
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
