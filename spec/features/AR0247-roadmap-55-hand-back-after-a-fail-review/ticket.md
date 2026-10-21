# AR0247 - Roadmap 55: hand-back after a FAIL review

```json
{
  "id": "AR0247",
  "title": "Roadmap 55: hand-back after a FAIL review",
  "date": "2026-10-21"
}
```

## Description

This ticket builds roadmap entry 55 in `spec/roadmap.md` in the `delivery` plugin.

## Goal

The specification is roadmap entry 55: its Delivers and Done means.

- Kind: feature
- Budget: 10

## Done means

- Everything entry 55's Delivers and Done means list, each edge case with its test: `/stopall` between the worker's end and the next review cancels it; a spawn refused at `maxAgents` is retried when a slot frees, not dropped; the second FAIL stops the loop at the review limit.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 55 as built.

## Scope

In:
- `packages/delivery`, its docs and tests, the coordinator role where it names the FAIL step, README, `arthur.mmd`, `test/structure.test.ts`.

Out:
- entries 56 and 59.

## Decisions

- 2026-10-21: Started by the coordinator; owner: continue Arthur, at most 12% of the weekly limit today.
