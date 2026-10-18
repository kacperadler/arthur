# AR0123 - Roadmap 28: Planning of large tickets

```json
{
  "id": "AR0123",
  "title": "Roadmap 28: Planning of large tickets",
  "date": "2026-10-18",
  "after": [
    "AR0120"
  ]
}
```

## Description

Roadmap entry 28 (`spec/roadmap.md`, "Planning of large tickets"), built as the entry says.

## Goal

A large ticket gets a plan the owner approves before code, as in the predecessor (vision: one human directs many agents).

- Kind: feature

## Done means

- Entry 28's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent (and the fakes the entry names).
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

In:
- What entry 28 names, in the package it names.

Out:
- Autopilot (entry 29).

## Decisions

- 2026-10-18: The owner: build the roadmap in its order, plugins included, starting today; this entry is next in that order.
- 2026-10-18: Coordinator (owner delegated Arthur calls): orchestration 875 -> 1007 (+132) and core 4764 -> 4828 (+64) accepted; the stricter plan guard (worker refused unless plan.md at HEAD matches the commit named in a 'Plan approved by the owner' Decisions line) accepted: a re-planned ticket must not start on a plan the owner never saw.
