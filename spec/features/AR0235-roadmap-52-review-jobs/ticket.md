# AR0235 - Roadmap 52: review jobs

```json
{
  "id": "AR0235",
  "title": "Roadmap 52: review jobs",
  "date": "2026-10-20"
}
```

## Description

This ticket builds roadmap entry 52 in `spec/roadmap.md`: the first piece of the `delivery` package, the job kind `review`.

## Goal

The specification is roadmap entry 52: its Delivers and Done means, F1 of AR0125 (a review of a ticket with `os=macos` lands on that machine) included.

- Kind: feature
- Budget: 8

## Done means

- Everything that entry 52's Delivers and Done means list, each edge case with its test: `PASS` not on the last line is no verdict; filing the same review twice is refused; a third review without `--round` is refused, naming the two FAILs; every review task carries its `Ticket:` line and placement reads its labels.
- The new `delivery` package uses only the published host API of `docs/plugin-api.md`; if it needs a new host member, stop and say so in the final message instead of adding it (the API is frozen since 51).
- F1 of this ticket, fixed here: a review with no verdict ends `failed` in the core's own record, `arthur jobs` and `job-ended`, through one new host member that lets a kind judge its run's outcome before its state is written (e.g. `Kind.outcome(result)` returning a failure reason). Tested.
- F2 of this ticket, fixed here: a review placed on another machine checks out the worker's tip there even when the worker ran elsewhere: the core pushes a spawn's extra commit next to `refs/arthur/base` (e.g. `SpawnRequest.fetch: commit`). Tested against the fake machine.
- `docs/plugin-api.md` names both new members, each as a recorded API change.
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 52 as built.

## Scope

In:
- `packages/delivery` (new), its docs and tests, `arthur.config.example.ts`, README, `arthur.mmd`;
- `test/structure.test.ts` budgets, raised only after naming what was cut first.

Out:
- entries 53 to 56 (review-needed, merge, hand-back, changelog).

## Decisions

- 2026-10-20: Owner: go on with Arthur and spend the weekly usage up to 99% until 08:00 on 2026-10-21 (94% at 21:36). Started by the coordinator under the owner's free hand in Arthur.
- 2026-10-20: Coordinator approved the new delivery line budget, 312 (new package, nothing cut elsewhere).
- 2026-10-20: Owner: fix F1 and F2 now, in this ticket, not later; approves the two host API additions they need (frozen API since 51) and the core line budget raise they cost.
- 2026-10-20: Coordinator (owner asleep, free hand): F1 as `Kind.verdicts` (a list of allowed last lines the wrapper checks) instead of `Kind.outcome(result)`: the wrapper runs apart from the plugins, on another machine too; data, not code, crosses that boundary.
