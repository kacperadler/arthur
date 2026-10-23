# AR0096 - The coordinator's role skips the prompt loader and `arthur roles`

```json
{
  "id": "AR0096",
  "title": "The coordinator's role skips the prompt loader and `arthur roles`",
  "date": "2026-10-17"
}
```

## Description

the coordinator gets its shipped role file only. A project override (`.agents/arthur/roles/coordinator.md`) and the criteria files are not read, and `arthur roles` does not list the coordinator, since it is not a registered role: the host gives a plugin no way to build a role's prompt outside a spawn.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: feat

Evidence:
- `packages/orchestration/src/coordinator.ts` (`--append-system-prompt <role file>`)
- Found by: 2026-10-17-ar0094-0dce1631 (worker), 2026-10-17

## Done means

- The fix, with a test that proves it: entry 25 (the coordinator's context on every turn) reads the role with the project's files; it should also make `arthur roles` show the coordinator and the file it reads.
- `npm test` and `npm run check` pass.

## Scope

In:
- entry 25 (the coordinator's context on every turn) reads the role with the project's files; it should also make `arthur roles` show the coordinator and the file it reads.

## Decisions

- 2026-10-17: Source: F1 of AR0094
