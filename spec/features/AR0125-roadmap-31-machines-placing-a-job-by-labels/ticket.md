# AR0125 - Roadmap 31: Machines: placing a job by labels

```json
{
  "id": "AR0125",
  "title": "Roadmap 31: Machines: placing a job by labels",
  "date": "2026-10-18",
  "after": [
    "AR0124"
  ]
}
```

## Description

Roadmap entry 31 (`spec/roadmap.md`, "Machines: placing a job by labels"), built as the entry says.

## Goal

Each job runs on a machine that has what its project needs, such as a Mac for an iOS build.

- Kind: feature

## Done means

- Entry 31's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent (and the fakes the entry names).
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

In:
- What entry 31 names, in the package it names.

Out:
- Resource caps (entries 32 to 34).

## Decisions

- 2026-10-18: The owner: build the roadmap in its order, plugins included, starting today; this entry is next in that order.
- 2026-10-18: Coordinator (owner delegated Arthur calls): machines budget 280 -> 375 accepted if the review finds nothing to cut; accepted the worker's calls: `--requires os=..,arch=..,tools=..`; the first `Ticket:` path counts, read from the main checkout; no project or ticket requirement without the projects plugin; `--machine` checked against labels only; `resources.free(machine)` answers a job count (entry 34 provides it, F2); only jobs in a run count against `maxJobs`.
- 2026-10-18: Coordinator: core budget 4649 -> 4662 after merging main accepted (13 lines: --requires and jobs.place on every spawn). AR0126 (core +102) merges first; this branch then merges main once more and gets one review of the merge.
- 2026-10-18: The owner: finish this ticket despite the Claude 7 Day usage reaching 58% (the stop point); no other new Arthur work.
