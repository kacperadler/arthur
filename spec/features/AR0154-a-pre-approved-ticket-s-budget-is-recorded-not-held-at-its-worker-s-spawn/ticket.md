# AR0154 - A pre-approved ticket's budget is recorded, not held at its worker's spawn

```json
{
  "id": "AR0154",
  "title": "A pre-approved ticket's budget is recorded, not held at its worker's spawn",
  "date": "2026-10-18"
}
```

## Description

`arthur ticket status <id> planned --autopilot` checks the budget against `autopilot.budgetMaxUsd` and writes it in the ticket's `Pre-approved by policy: ..., budget $<n> of the $<cap> cap` line, and the coordinator is told to spawn the worker with `--budget <n>`. Nothing checks that it does: `arthur spawn 'Ticket: ...'` without `--budget` takes `core.jobs.budgetUsd` (default 2), `--budget 10` or `--budget 0` (no limit) pass, and `arthur continue --budget` replaces it, so a pre-approved job can spend past the cap without the owner's word.

## Goal

A pre-approved ticket's worker cannot spend more than the budget recorded at approval.

- Kind: risk

Evidence:
- `packages/orchestration/src/autopilot.ts`
- Found by: 2026-10-18-ar0140-d850a4c7 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: a `beforeSpawn` of orchestration (beside `unapproved` in plans.ts) that refuses a worker, and a continue, on a ticket whose `ticket.md` at HEAD holds a `Pre-approved by policy` line with a `budgetUsd` of 0 or above that line's budget, naming it; an owner's own approval after it (a Decisions line the owner writes) lifts it. Out: the per-feature caps of the resources plugin, which already sum a ticket's spend.
- `npm test` and `npm run check` pass.

## Scope

In:
- a `beforeSpawn` of orchestration (beside `unapproved` in plans.ts) that refuses a worker, and a continue, on a ticket whose `ticket.md` at HEAD holds a `Pre-approved by policy` line with a `budgetUsd` of 0 or above that line's budget, naming it; an owner's own approval after it (a Decisions line the owner writes) lifts it. Out: the per-feature caps of the resources plugin, which already sum a ticket's spend.

## Decisions

- 2026-10-18: Source: F1 of AR0140
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
