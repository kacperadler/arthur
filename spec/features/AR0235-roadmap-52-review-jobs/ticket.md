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
