# AR0529 - The activity plugin: one file per day of who did what, kept 90 days

```json
{
  "id": "AR0529",
  "title": "The activity plugin: one file per day of who did what, kept 90 days",
  "date": "2026-10-27"
}
```

## Description

Roadmap entry 100 of the plan. Built from the approved plan of AR0527 (`spec/features/AR0527-plan-an-activity-log-plugin-what-each-user-and-each-agent-or-the-harness-did-one/plan.md`, approved in AR-D203; the owner: not built on 2026-10-27).

## Goal

A new optional `activity` plugin writes `<home>/activity/days/YYYY-MM-DD.jsonl`, one line per logged event with its actor and `on`, as the plan's sections 2 to 4 set out: text cut at 300 characters, forwarded words left out, media without paths, only `arthur run` writes, old days removed after `keepDays` (90).

- Kind: feat

## Done means

- The plugin, made with `arthur plugin new activity --budget 350`, maps the plan's event list to lines; tests for each event, the cut, a forward, the day boundary in `core.timeZone`, a replay that writes nothing twice, a gap filled once, a cut last line, and retention.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/activity/` (new), its docs, `arthur.config.example.ts`.

Out:
- The views: the next ticket.

## Decisions

- 2026-10-27: Source: the approved plan of AR0527 (AR-D203)
