# AR0195 - `arthur youtrack issue list` reads every issue of a project, resolved ones too

```json
{
  "id": "AR0195",
  "title": "`arthur youtrack issue list` reads every issue of a project, resolved ones too",
  "date": "2026-10-19"
}
```

## Description

the list asks `project: <ID>` and pages to the end, as entry 44 asks, so a project with thousands of issues prints thousands of lines into the coordinator's context, most of them resolved. [INFERENCE] no measurement on a real server.

## Goal

`arthur youtrack issue list` does not flood the coordinator's context with a project's resolved issues.

- Kind: improvement

Evidence:
- `packages/youtrack/src/youtrack-command.ts` (the `query` of `issue list`)
- Found by: 2026-10-19-ar0189-youtrack-502e11ad (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: a filter flag, e.g. `--query <YouTrack query>` appended to the project's, or unresolved only by default with `--all`; a product choice for the owner.
- `npm test` and `npm run check` pass.

## Scope

In:
- a filter flag, e.g. `--query <YouTrack query>` appended to the project's, or unresolved only by default with `--all`; a product choice for the owner.

## Decisions

- 2026-10-19: Source: F2 of AR0189
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
- 2026-10-19: Open question to the owner: unresolved only by default with `--all`, or all with `--query`. The coordinator recommends the first.
- 2026-10-19: The owner decided: `issue list` shows unresolved issues by default, and `--all` shows every issue. It is built on AR0197's branch.
