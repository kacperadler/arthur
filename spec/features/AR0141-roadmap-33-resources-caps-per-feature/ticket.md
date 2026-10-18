# AR0141 - Roadmap 33: Resources: caps per feature

```json
{
  "id": "AR0141",
  "title": "Roadmap 33: Resources: caps per feature",
  "date": "2026-10-18"
}
```

## Description

Roadmap entry 33 (`spec/roadmap.md`), built as the entry says.

## Goal

All jobs of one ticket together never exceed the ticket's cost, time, CPU and memory caps.

- Kind: feature

## Done means

- Entry 33's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent.
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

Out:
- Free-resource placement (entry 34).

## Decisions

- 2026-10-18: The owner: build the roadmap in its order; on 2026-10-18 evening he asked for a night plan for Arthur with Claude 7 Day usage up to 75%. This entry is in that plan.
- 2026-10-18: Coordinator (owner delegated Arthur calls): core 4764 -> 4786 (+22: ticket slice, ran file, cost/budget/seconds in jobs.list, stop on jobs.block) and resources 42 -> 231 (perFeature, ticket caps, background check, arthur resources) accepted; the review checks they buy only that. A missing cost file counts as the whole budget, and a job stopped at a cap ends blocked: accepted.
