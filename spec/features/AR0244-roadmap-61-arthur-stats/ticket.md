# AR0244 - Roadmap 61: arthur stats

```json
{
  "id": "AR0244",
  "title": "Roadmap 61: arthur stats",
  "date": "2026-10-21"
}
```

## Description

This ticket builds roadmap entry 61 in `spec/roadmap.md`: `arthur stats` in the `manage` plugin.

## Goal

The specification is roadmap entry 61: its Delivers and Done means.

- Kind: feat
- Budget: 6

## Done means

- Everything entry 61's Delivers and Done means list, each edge case with its test: no merged ticket; a ticket without reviews; a ticket whose cost file is missing counts as unknown, not zero.
- Only the published host API of `docs/plugin-api.md`; any new host member: stop and say so.
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 61 as built.

## Scope

In:
- `packages/manage`, its docs and tests, README, `arthur.mmd`, `test/structure.test.ts` (manage budget).

Out:
- entries 62 to 64.

## Decisions

- 2026-10-21: Started by the coordinator under the owner's free hand (99% usage until 08:00; 98% at 00:41); the last entry of the night, small, so usage stays under 99%.
- 2026-10-21: Coordinator: cost read from outcome.md`s `- Cost:` line (survives prune); missing or n/a counts unknown. Accepted.
