# AR0304 - A new plugin's ticket without a plan can still be placed on another machine

```json
{
  "id": "AR0304",
  "title": "A new plugin's ticket without a plan can still be placed on another machine",
  "date": "2026-10-22"
}
```

## Description

AR0298 places a new plugin's worker on the local machine through the plan (the planner's section, then `--machine local` in `plan-ended.md` step 4). A ticket without `- Plan: yes` has no such step: the machines plugin places it by labels only, and a ticket's JSON block can name `requires` but no machine, so its worker may start on another machine, read that it cannot run `arthur plugin new` there, and end; the coordinator then spawns it again with `--machine local`, as the worker's final message says. One start is wasted, and the respawn rests on the coordinator reading that message.

## Goal

A new plugin's ticket runs on the local machine even without a plan, so no worker is placed where `arthur plugin new` cannot run.

- Kind: improvement

Evidence:
- `packages/machines/src/machine-place.ts:40` (`need`), `packages/develop/src/plugin-new.ts` (`pluginNewSection`)
- Found by: 2026-10-22-ar0298-8e2fe51c (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: let a ticket's JSON block pin its machine (for example `"machine": "local"`), read by `need` beside `requires`, and have the planner or the ticket's author set it for a new plugin; or have develop refuse a worker's spawn on another machine for a ticket that makes a new plugin, if that can be told without parsing the human's Markdown. What stays out: the CLI loading plugins without `arthur.config.ts`.
- `npm test` and `npm run check` pass.

## Scope

In:
- let a ticket's JSON block pin its machine (for example `"machine": "local"`), read by `need` beside `requires`, and have the planner or the ticket's author set it for a new plugin; or have develop refuse a worker's spawn on another machine for a ticket that makes a new plugin, if that can be told without parsing the human's Markdown. What stays out: the CLI loading plugins without `arthur.config.ts`.

## Decisions

- 2026-10-22: Source: F1 of AR0298
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
