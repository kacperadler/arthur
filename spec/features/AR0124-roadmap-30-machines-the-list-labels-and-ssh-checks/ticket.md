# AR0124 - Roadmap 30: Machines: the list, labels, and SSH checks

```json
{
  "id": "AR0124",
  "title": "Roadmap 30: Machines: the list, labels, and SSH checks",
  "date": "2026-10-18"
}
```

## Description

Roadmap entry 30 (`spec/roadmap.md`, "Machines: the list, labels, and SSH checks"), built as the entry says.

## Goal

Arthur knows the other machines it may run jobs on, checked at start (vision: runs on one machine, jobs on others over SSH).

- Kind: feature

## Done means

- Entry 30's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent (and the fakes the entry names).
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

In:
- What entry 30 names, in the package it names.

Out:
- Placing jobs by labels (entry 31).

## Decisions

- 2026-10-18: The owner: build the roadmap in its order, plugins included, starting today; this entry is next in that order.
- 2026-10-18: Coordinator (owner delegated Arthur calls): accepted the worker's calls: a version mismatch counts as offline; labels.os and labels.arch are optional; maxJobs left out means no own limit; machines line budget 280; tool checks left to entry 80, start notice to 80 and 38.
