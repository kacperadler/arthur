# AR0345 - Two docs disagree on what Arthur sends another machine

```json
{
  "id": "AR0345",
  "title": "Two docs disagree on what Arthur sends another machine",
  "date": "2026-10-23"
}
```

## Description

the reader of `coordinator.md`, or of the spawn's warning line, takes it that nothing secret leaves the host; a provider's key does.

## Goal

The docs agree on exactly what Arthur sends another machine, matching the code.

- Kind: cleanup

Evidence:
- `packages/orchestration/docs/commands/coordinator.md:139` ("A job on another machine starts with none, since Arthur sends another machine no secret"), `packages/core/docs/commands/spawn.md:61` ("a secret only as a `prepare`'s variable on the launch's stdin (a provider's key of the models plugin, for the job's agent)"), `packages/core/src/jobs.ts:176` (the spawn's warning says the same as `coordinator.md`)
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: `coordinator.md:139` and the warning in `jobs.ts:176` say "Arthur sends another machine no MCP secret" and point to `spawn.md`, "On another machine"; `spawn.md:22` adds that a `prepare`'s variable is in the environment of every tool call of the job too, as `coordinator.md:141` says for MCP. No test: docs only; the warning's test in `machine.test.ts` ("a job on another machine starts with none of its role's MCP servers, and its spawn warns, naming them") changes with the line.
- `npm test` and `npm run check` pass.

## Scope

In:
- `coordinator.md:139` and the warning in `jobs.ts:176` say "Arthur sends another machine no MCP secret" and point to `spawn.md`, "On another machine"; `spawn.md:22` adds that a `prepare`'s variable is in the environment of every tool call of the job too, as `coordinator.md:141` says for MCP. No test: docs only; the warning's test in `machine.test.ts` ("a job on another machine starts with none of its role's MCP servers, and its spawn warns, naming them") changes with the line.

## Decisions

- 2026-10-23: Source: F9 of AR0319
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
