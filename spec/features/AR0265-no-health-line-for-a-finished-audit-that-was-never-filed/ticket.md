# AR0265 - No health line for a finished audit that was never filed

```json
{
  "id": "AR0265",
  "title": "No health line for a finished audit that was never filed",
  "date": "2026-10-21",
  "after": [
    "AR0266"
  ]
}
```

## Description

the harness's health named a finished audit whose report is not in `spec/quality/` after a grace (`/home/kacper/harness/src/health-jobs.ts:97-103`). Here an audit the coordinator never files leaves the next audit's commit list starting from the older report, and nothing says so; `arthur prune` of the unfiled job loses its proposals.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: improvement

Evidence:
- `packages/manage/src/health-checks.ts`, `packages/manage/src/audit-file.ts`
- Found by: 2026-10-21-ar0261-roadmap-62-audit-7f8971f2 (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: a manage health check: an `audit` job ended `finished` for an hour whose id no `- Job:` line of a report in `spec/quality/` names. Out: filing it automatically.
- `npm test` and `npm run check` pass.

## Scope

In:
- a manage health check: an `audit` job ended `finished` for an hour whose id no `- Job:` line of a report in `spec/quality/` names. Out: filing it automatically.

## Decisions

- 2026-10-21: Source: F3 of AR0261
- 2026-10-21: Approved by the owner (Telegram).
