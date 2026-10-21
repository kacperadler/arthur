# AR0263 - Roadmap 83: findings, what happens to them per project

```json
{
  "id": "AR0263",
  "title": "Roadmap 83: findings, what happens to them per project",
  "date": "2026-10-21"
}
```

## Description

This ticket builds roadmap entry 83 in `spec/roadmap.md` in the `findings` plugin.

## Goal

The specification is roadmap entry 83: its Delivers and Done means.

- Kind: feature
- Budget: 9

## Done means

- Everything entry 83's Delivers and Done means list, each refusal and edge case with its test.
- An unknown mode refused at load; no open finding makes nothing; a finding already ticket, fixed or dropped is left alone; grouped with one finding makes one ticket; a project without the plugin keeps findings open and the merge says so once; tested with real files.
- Only the published host API of `docs/plugin-api.md`; any new host member is recorded there under "Changes since entry 51".
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 83 as built.

## Scope

In:
- `packages/findings`, its docs and tests, README, `arthur.mmd`, `test/structure.test.ts`.

## Decisions

- 2026-10-21: Started by the coordinator; owner: continue Arthur, at most 10% of the weekly limit today (5% at 14:52).
- 2026-10-21: Coordinator (free hand) accepted the worker picks: `findings.mode` is a map from project name to mode in the findings plugin options (default `ticket`); a ticket from a finding gets its Kind and `budget`; every worker prompt carries the findings.md template.
