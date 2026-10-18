# AR0126 - Roadmap 32: Resources: caps per job

```json
{
  "id": "AR0126",
  "title": "Roadmap 32: Resources: caps per job",
  "date": "2026-10-18"
}
```

## Description

Roadmap entry 32 (`spec/roadmap.md`, "Resources: caps per job"), built as the entry says.

## Goal

One job can never take the whole machine's CPU or memory, so the coordinator and the other jobs keep running.

- Kind: feature

## Done means

- Entry 32's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent, with a test slice name, never the production one.
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

In:
- The new `resources` plugin and the core's job scope reading `jobs.limits`.

Out:
- Caps per feature and free-resource placement (entries 33, 34).

## Decisions

- 2026-10-18: The owner: build the roadmap in its order, plugins included, starting today; this entry is next in that order.
- 2026-10-18: Coordinator (owner delegated Arthur calls): core budget 4649 -> 4691 and resources 42 accepted; `check(options, core)` accepted before the API freeze (entry 51); `perFeature` and `keepFree` stay refused until entries 33, 34 and 69 build them (an option that does nothing is not accepted).
- 2026-10-18: Coordinator: after merging main (AR0124) the core raise is +54, to 4703, accepted.
- 2026-10-18: Worker, on the coordinator's instruction to record it: core line budget 4649 -> 4751 (102 lines: `jobs.limits`, the caps on each job's scope, the wrapper's memory watch, the once-per-machine notice); AR0120 had used the core's spare lines, so none were left; resources budget 42.
- 2026-10-18: Coordinator: core 4751 after merging main with AR0120 accepted (the same 102 lines of this ticket).
- 2026-10-18: The owner: finish this ticket despite the Claude 7 Day usage reaching 58% (the stop point); no other new Arthur work.
