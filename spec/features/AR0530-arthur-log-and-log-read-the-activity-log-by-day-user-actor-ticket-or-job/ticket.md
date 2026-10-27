# AR0530 - `arthur log` and `/log`: read the activity log by day, user, actor, ticket or job

```json
{
  "id": "AR0530",
  "title": "`arthur log` and `/log`: read the activity log by day, user, actor, ticket or job",
  "date": "2026-10-27"
}
```

## Description

Roadmap entry 101 of the plan. Built from the approved plan of AR0527 (`spec/features/AR0527-plan-an-activity-log-plugin-what-each-user-and-each-agent-or-the-harness-did-one/plan.md`, approved in AR-D203; the owner: not built on 2026-10-27).

## Goal

The owner reads the activity log from the shell and the phone, as the plan's section 5 sets out: `arthur log` with `--day`, `--user` (his lines and the lines on his word), `--actor`, `--ticket`, `--job`, `--project`, `--all`; `/log` with the last 30 lines.

- Kind: feat

## Done means

- Each filter and the default (today, read-only commands hidden) has a test; `/log` answers on a channel through the fake host.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/activity/` (the command and its doc page).

Out:
- The web panel's Log screen: roadmap 77.

## Decisions

- 2026-10-27: Source: the approved plan of AR0527 (AR-D203)
