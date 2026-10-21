# AR0252 - Roadmap 56: arthur changelog

```json
{
  "id": "AR0252",
  "title": "Roadmap 56: arthur changelog",
  "date": "2026-10-21"
}
```

## Description

This ticket builds roadmap entry 56 in `spec/roadmap.md` in the `delivery` plugin.

## Goal

The specification is roadmap entry 56: its Delivers and Done means.

- Kind: feature
- Budget: 8

## Done means

- Everything entry 56's Delivers and Done means list, each edge case with its test: no merged ticket; a ticket without a kind; the same output from two runs (stable order).
- `arthur merge` rebuilds `CHANGELOG.md` after a merge that went in.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 56 as built.

## Scope

In:
- `packages/delivery`, its docs and tests, README, `arthur.mmd`, `test/structure.test.ts`.

Out:
- entry 59.

## Decisions

- 2026-10-21: Started by the coordinator; owner: continue Arthur, at most 10% of the weekly limit today (2% at 12:02).
- 2026-10-21: Coordinator (free hand) accepted the worker picks: feature and improvement under Added, bug and risk under Fixed, cleanup under Changed, else Other; CHANGELOG.md does not count as a dirty main for `arthur merge`, and the after-merge procedure commits it with the board.
