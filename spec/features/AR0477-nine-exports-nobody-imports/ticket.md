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
- 2026-10-27: AR0477 approved by the owner (morning of 2026-10-27, one list of 18); the owner: "apprvoed: AR0467, AR0466, AR0471-AR0473, AR0464, AR0465, AR0468-AR0470, AR0474-AR0477, AR0402-AR0405" (AR-D137)
- 2026-10-28: Merge AR0477 now; the owner: "AR-D216 1 - IN THE FUTURE IF THERE IS SOMETHING TO MERGE AND YOU CAN MERGE IT, JUST MERE IT, DO NOT ASK (in arthur project)" (AR-D216)
