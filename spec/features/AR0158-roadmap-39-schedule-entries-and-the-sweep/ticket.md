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
- 2026-10-19: Coordinator (owner delegated Arthur calls): the four choices accepted: a procedure is a relative .md inside the run folder (absolute, .., non-.md, symlinks refused); a new daily entry skips slots before its first sweep except one at most 5 min before; a slot run over 5 min late is marked late; a refused scheduled spawn tells the coordinator and keeps the slot claimed.
