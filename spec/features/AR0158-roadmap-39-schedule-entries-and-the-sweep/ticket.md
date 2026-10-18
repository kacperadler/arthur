# AR0158 - Roadmap 39: Schedule entries and the sweep

```json
{
  "id": "AR0158",
  "title": "Roadmap 39: Schedule entries and the sweep",
  "date": "2026-10-19"
}
```

## Description

Roadmap entry 39 (`spec/roadmap.md`), built as the entry says.

## Goal

Arthur runs approved work at set times, so jobs run while the owner is away (vision: background tasks).

- Kind: feature

## Done means

- Entry 39's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent.
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

Out:
- Registered entries and `arthur schedule` (entry 40).

## Decisions

- 2026-10-18: The owner asked for a night plan for Arthur with Claude 7 Day usage up to 75%. Entries 37 and 38 touch the session plugin and run one after another; 39 (schedule) is independent of them and fills the free slot. 80, 93, 94 and 82 wait for 38 or 41.
- 2026-10-19: The schedule package gets a line budget of 277 in `test/structure.test.ts` (a new package; the core is unchanged): the entries' checks and slots (`entry.ts`), the claims of the run state (`run-state.ts`), the sweep (`sweep.ts`) and the plugin with its option check (`schedule.ts`).
