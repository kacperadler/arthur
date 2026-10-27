# AR0477 - Nine exports nobody imports

```json
{
  "id": "AR0477",
  "title": "Nine exports nobody imports",
  "date": "2026-10-27"
}
```

## Description

Nine values exported but used only in their own file lose the `export` keyword.

## Goal

the audit criteria count an export nobody imports as dead code. Each one makes a file look like it has more interface than it does.

Evidence:
each one below is used only inside its own file. `grep -w` over `packages`, `test` and `site/scripts` finds no other file, and none of these files is in a package's `exports`.
- `packages/develop/src/plugin-new.ts:66` `pluginNew`
- `packages/manage/src/health-checks.ts:16` `LOW`
- `packages/orchestration/src/coordinator.ts:23` `PID_FILE`
- `packages/orchestration/src/plans.ts:10` `PLAN_REVIEW`
- `packages/orchestration/src/silent.ts:15` `silentState`
- `packages/youtrack/src/youtrack-api.ts:18` `PAGE`
- `packages/session/src/start-notice.ts:13` `TURN_FAILED`
- `packages/models/src/usage.ts:81` `windowText`
- `packages/core/src/roles.ts:18` `PROJECT_FILES`

- Kind: chore

## Done means

- The nine names are no longer exported; `npm run check` and `npm test` pass.

## Scope

In:
drop the `export` keyword from these nine. Exports in the published `./options` files (`MODES`, `WAKES`, `MAX_TIMEOUT`) and exported types stay.

Out:
- Anything beyond the proposal.

## Decisions

- 2026-10-27: Source: audit spec/quality/2026-10-27.md
