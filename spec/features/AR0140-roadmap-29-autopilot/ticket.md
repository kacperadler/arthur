# AR0140 - Roadmap 29: Autopilot

```json
{
  "id": "AR0140",
  "title": "Roadmap 29: Autopilot",
  "date": "2026-10-18",
  "after": [
    "AR0123"
  ]
}
```

## Description

Roadmap entry 29 (`spec/roadmap.md`), built as the entry says.

## Goal

An audit's or a finding's small bug or cleanup ticket can be pre-approved, so it runs overnight without waiting for the owner.

- Kind: feat

## Done means

- Entry 29's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent.
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

Out:
- Anything beyond entry 29.

## Decisions

- 2026-10-18: The owner: build the roadmap in its order; on 2026-10-18 evening he asked for a night plan for Arthur with Claude 7 Day usage up to 75%. This entry is in that plan.
- 2026-10-18: Coordinator (owner delegated Arthur calls): orchestration 1024 -> 1135 (+111, autopilot.ts) and core 4850 -> 4864 (+14, --autopilot) accepted; the delivery.alwaysReview call shape for entry 53, the Source: Decisions line as the ticket's origin, and criteria/autopilot.md read next to styleguide: accepted.
