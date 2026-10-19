# AR0168 - Orchestration cannot register the morning report while schedule is optional

```json
{
  "id": "AR0168",
  "title": "Orchestration cannot register the morning report while schedule is optional",
  "date": "2026-10-19"
}
```

## Description

`schedule.register` exists only once schedule's `setup` has run, and the host orders setups by `requires`, else by the config's order. Roadmap entry 65 has orchestration, the required plugin, register the morning report from `morningReport.at`. With `requires: ["schedule"]` schedule becomes required too (the host refuses a load without it); without it, a config that lists orchestration before schedule, or turns schedule off, makes `host.call("schedule.register", ...)` throw `no plugin provides it` in orchestration's `setup`, which fails the whole load. Calling it from `start` instead misses the `arthur` binary, which runs only `setup`, so `arthur schedule list` would not show the entry. Entries 62, 63 and 72 (manage, docker) have the same choice, though for them `requires: ["schedule"]` is acceptable.

## Goal

The morning report is registered by orchestration when the schedule plugin is enabled, and nothing breaks when it is not.

- Kind: risk

Evidence:
- `packages/core/src/host.ts:100-121` (`setupOrder`), `packages/schedule/src/schedule.ts` (`host.provide("schedule.register", ...)` in `setup`)
- Found by: 2026-10-18-ar0163-a0544f1a (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: decide in entry 65 between making schedule required by orchestration, or an optional ordering in the core (a plugin's `after: ["schedule"]`: set up after it when it is loaded, no refusal when it is not) with orchestration registering only when `schedule.register` is provided. Nothing changes in schedule.
- `npm test` and `npm run check` pass.

## Scope

In:
- decide in entry 65 between making schedule required by orchestration, or an optional ordering in the core (a plugin's `after: ["schedule"]`: set up after it when it is loaded, no refusal when it is not) with orchestration registering only when `schedule.register` is provided. Nothing changes in schedule.

## Decisions

- 2026-10-19: Source: F1 of AR0163
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
