# AR0266 - Roadmap 63: the retro

```json
{
  "id": "AR0266",
  "title": "Roadmap 63: the retro",
  "date": "2026-10-21"
}
```

## Description

This ticket builds roadmap entry 63 in `spec/roadmap.md` in the `manage` plugin, next to the audit of entry 62 (AR0261).

## Goal

The specification is roadmap entry 63: its Delivers and Done means.

- Kind: feature
- Budget: 10

## Done means

- Everything entry 63's Delivers and Done means list, each edge case with its test: `arthur retro-due` exactly at the threshold (10 merges and 2 FAILs, or 5 findings), with no retro yet; `/retro` with no page answers so instead of failing.
- Filed as `spec/retro/<date>.md` and the phone page `spec/retro/<date>.html`; `/retro` sends the newest page; the coordinator's context gets the retro-due line.
- Reuses the audit's filing (`arthur ticket file <job>`) and schedule pattern; no second copy of them.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 63 as built.

## Scope

In:
- `packages/manage`, its roles, criteria and docs, tests, README, `arthur.mmd`, `test/structure.test.ts`.

## Decisions

- 2026-10-21: Started by the coordinator; owner: continue Arthur, at most 10% of the weekly limit today (5% at 15:2x).
- 2026-10-21: Coordinator (free hand) accepted the worker picks: a retro is due at 10 merges or more and, within them, 2 FAIL reviews or 5 findings, as the harness does; optional `retro.budgetUsd` (default the core jobs.budgetUsd); manage line budget 910.
