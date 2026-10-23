# AR0080 - /board, /task and /findings move into orchestration, with host.jobs.list()

```json
{
  "id": "AR0080",
  "title": "/board, /task and /findings move into orchestration, with host.jobs.list()",
  "date": "2026-10-16",
  "after": [
    "AR0094"
  ]
}
```

## Description

B3 of the core line review: net about 105 lines out of the core; roadmap 18 and 23 edited. At or after entry 23 only.

## Goal

The core stays small enough to understand, with capability in plugins (vision); the plan is `spec/quality/core-lines-2026-10-16.md`, proposal B3.

- Kind: refactor

## Done means

- What proposal B3 of `spec/quality/core-lines-2026-10-16.md` names, and no behaviour change: every existing test passes unchanged except where the report names a doc or test edit.
- `npm test` and `npm run check` pass.
- `host.jobs.list()` is designed so `host.jobs.running()` (added by AR0094) is a filter of it, or the difference between them is named in `docs/` (F2 of AR0094).

## Scope

In:
- The files proposal B3 names.

Out:
- Anything the report does not name.

## Decisions

- 2026-10-16: Coordinator: from the core line review (AR0069), accepted.
- 2026-10-16: Coordinator: do not spawn before entry 23 (the orchestration plugin) is merged.
- 2026-10-17: Coordinator: F2 of AR0094 (running() and list() overlap) joins this ticket.
- 2026-10-17: Coordinator: both side effects of the move accepted: with a config that does not load, board, task and findings are unknown commands (exit 2, the load error printed); cli.test.ts drops them from the core lists and its BOARD config registers a small board command.
