# AR0205 - The coordinator's role does not say when it may write to YouTrack

```json
{
  "id": "AR0205",
  "title": "The coordinator's role does not say when it may write to YouTrack",
  "date": "2026-10-19"
}
```

## Description

AR0194 gave the role one line for reading (`arthur youtrack issue get <id>`), and "Nothing more". Roadmap 45 adds `create`, `update`, `set` and `work`, which change the owner's tracker; the role neither names them nor says whether the coordinator writes only when the owner asks.

## Goal

The coordinator's role says when it may write to YouTrack and when it asks the owner first.

- Kind: improvement

Evidence:
- `packages/orchestration/roles/coordinator.md`, "Commands"
- Found by: 2026-10-19-ar0197-youtrack-e4f38f0b (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: one line in the role: write to YouTrack (`arthur youtrack --help`) only when the owner asks, and say in the reply what was written. A product decision for the owner: whether the coordinator may log work items or set fields on its own.
- `npm test` and `npm run check` pass.

## Scope

In:
- one line in the role: write to YouTrack (`arthur youtrack --help`) only when the owner asks, and say in the reply what was written. A product decision for the owner: whether the coordinator may log work items or set fields on its own.

## Decisions

- 2026-10-19: Source: F2 of AR0197
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
