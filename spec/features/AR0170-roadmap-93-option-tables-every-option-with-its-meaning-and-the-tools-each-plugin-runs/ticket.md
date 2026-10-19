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
- 2026-10-19: Worker: the Goal's "each plugin built so far" covers machines, resources, session and schedule too, built before this entry although its Package line names only orchestration and projects; each gets its table and `./options` here. Line budgets in `test/structure.test.ts` rise: core 4873 -> 4939 (+66), orchestration 1146 -> 1174 (+28), projects 320 -> 325 (+5), machines 375 -> 399 (+24), resources 401 -> 458 (+57), session 691 -> 722 (+31), schedule 497 -> 552 (+55), mostly the one-line meanings and defaults.
