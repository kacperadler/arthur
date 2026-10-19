# AR0204 - `issue update` overwrites a description changed since it was read

```json
{
  "id": "AR0204",
  "title": "`issue update` overwrites a description changed since it was read",
  "date": "2026-10-19"
}
```

## Description

roadmap 45 asks only an article's update to refuse a change made meanwhile, so `arthur youtrack issue update <id> <file>` replaces the summary and description whatever happened since the issue was read: an edit the owner made in YouTrack in between is lost without a word.

## Goal

`issue update` refuses to overwrite a description someone changed since it was read, as `article update` already does.

- Kind: risk

Evidence:
- `packages/youtrack/src/youtrack-write.ts`, `update`
- Found by: 2026-10-19-ar0197-youtrack-e4f38f0b (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: the same check as the article's: `issue get` prints `version: <updated>` and `issue update` takes it, refusing when the issue's `updated` moved. Out: comments and fields, which are not replaced whole.
- `npm test` and `npm run check` pass.

## Scope

In:
- the same check as the article's: `issue get` prints `version: <updated>` and `issue update` takes it, refusing when the issue's `updated` moved. Out: comments and fields, which are not replaced whole.

## Decisions

- 2026-10-19: Source: F1 of AR0197
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
