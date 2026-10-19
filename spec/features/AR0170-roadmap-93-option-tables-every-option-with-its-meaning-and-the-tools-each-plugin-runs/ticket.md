# AR0170 - Roadmap 93: Option tables, every option with its meaning, and the tools each plugin runs

```json
{
  "id": "AR0170",
  "title": "Roadmap 93: Option tables, every option with its meaning, and the tools each plugin runs",
  "date": "2026-10-19"
}
```

## Description

Roadmap entry 93 (`spec/roadmap.md`), built as the entry says.

## Goal

Every option of the core and of each plugin built so far has one table with its meaning, type and default, and each plugin names the tools it runs, so the owner and `arthur setup` (94) read them from one place.

- Kind: feature

## Done means

- Entry 93's Delivers, Also delivers and Done means, each edge case with its test.
- The README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

Out:
- `arthur setup` (entry 94).

## Decisions

- 2026-10-19: The owner asked for a night plan for Arthur with Claude 7 Day usage up to 75%; entry 93 is next in order (depends on 23 and 41, built).
- 2026-10-19: Coordinator (owner delegated Arthur calls): tables for every built plugin (not only orchestration and projects) confirmed, as the Goal says; the each shape for list and record items accepted; any line budget raise in test/structure.test.ts for these tables accepted, the review checks it buys only them.
