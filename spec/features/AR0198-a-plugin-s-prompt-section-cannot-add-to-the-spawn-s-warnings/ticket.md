# AR0198 - A plugin's prompt section cannot add to the spawn's warnings

```json
{
  "id": "AR0198",
  "title": "A plugin's prompt section cannot add to the spawn's warnings",
  "date": "2026-10-19"
}
```

## Description

a provider of `prompt` returns text or undefined only, so commit-rules says a missing or empty rule file with `console.error("warning: ...")`. In `arthur spawn` that reaches stderr beside the core's own `warning:` lines, but a spawn through `host.jobs.spawn` (a schedule entry in `arthur run`, later delivery) gets it only in the run's log, not in the job's `warnings` as a missing criteria file is.

## Goal

A plugin's prompt section can add a warning to the spawn line, so the owner sees it when the job starts.

- Kind: feat

Evidence:
- `packages/core/src/roles.ts:125` (`prompt`), `packages/commit-rules/src/commit-rules.ts:45`
- Found by: 2026-10-19-ar0188-commit-rules-3a76b3d2 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: let a `prompt` provider return `{ text, warnings }` and join those warnings to `Started.warnings`; commit-rules then returns its warning instead of printing it. Out: any change to how `arthur spawn` prints warnings.
- `npm test` and `npm run check` pass.

## Scope

In:
- let a `prompt` provider return `{ text, warnings }` and join those warnings to `Started.warnings`; commit-rules then returns its warning instead of printing it. Out: any change to how `arthur spawn` prints warnings.

## Decisions

- 2026-10-19: Source: F1 of AR0188
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
