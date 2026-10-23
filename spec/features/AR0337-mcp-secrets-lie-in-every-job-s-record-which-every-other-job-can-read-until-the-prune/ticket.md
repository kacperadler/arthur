# AR0337 - MCP secrets lie in every job's record, which every other job can read, until the prune

```json
{
  "id": "AR0337",
  "title": "MCP secrets lie in every job's record, which every other job can read, until the prune",
  "date": "2026-10-23"
}
```

## Description

a token meant for one role (the reviewer's GitHub token of the example in `packages/orchestration/docs/commands/coordinator.md`) is readable by every job of every project for as long as the record lives; `coordinator.md:141` says the agent's own tools can read its own file, not that every other job can, nor that it stays.

## Goal

A job's MCP secrets are readable only by that job (its own record, or passed on stdin), never by another job before the prune; tested.

- Kind: security

Evidence:
- `packages/core/src/job-record.ts:31`, `packages/orchestration/src/mcp.ts:95`, `packages/core/src/env-refusal.ts:12` (the guard's names), `packages/core/src/job-records.ts:165` (the one removal, at `arthur prune`)
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: remove `<record>/mcp/` when the job's run ends, in the wrapper's end (`packages/core/src/wrapper.ts`, with `commits`), and at `arthur continue` write it again from the role's answer; add `.mcp.json` to the env guard's names (`env-refusal.ts`, `NAME`), with its row in the `PROJECT` table of `packages/core/test/env-guard.test.ts`; say in `coordinator.md`, "MCP servers", that every job of the user can read the file while it exists. Tests: a wrapper test that the record holds no `mcp/` once `state` is `ended` and a continue writes it back; the guard table rows. Out: a sandbox between jobs (AR0320).
- `npm test` and `npm run check` pass.

## Scope

In:
- remove `<record>/mcp/` when the job's run ends, in the wrapper's end (`packages/core/src/wrapper.ts`, with `commits`), and at `arthur continue` write it again from the role's answer; add `.mcp.json` to the env guard's names (`env-refusal.ts`, `NAME`), with its row in the `PROJECT` table of `packages/core/test/env-guard.test.ts`; say in `coordinator.md`, "MCP servers", that every job of the user can read the file while it exists. Tests: a wrapper test that the record holds no `mcp/` once `state` is `ended` and a continue writes it back; the guard table rows. Out: a sandbox between jobs (AR0320).

## Decisions

- 2026-10-23: Source: F1 of AR0319
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
