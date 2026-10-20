# AR0237 - Roadmap 53: arthur review-needed

```json
{
  "id": "AR0237",
  "title": "Roadmap 53: arthur review-needed",
  "date": "2026-10-20"
}
```

## Description

This ticket builds roadmap entry 53 in `spec/roadmap.md`: `arthur review-needed` in the `delivery` plugin, and `host.jobs.registerExtension(url)` in the core.

## Goal

The specification is roadmap entry 53: its Delivers and Done means.

- Kind: feature
- Budget: 8

## Done means

- Everything entry 53's Delivers and Done means list, the table of branches with the decision for each included, and each named edge case with its test (a renamed file on the always-review list; a branch with no commits; a docs-only branch that also deletes a file; the `checks` cases: joined and piped commands, an undeclared script or broken `package.json`, `npm t` and `npm run test`, a command that only mentions `npm test`, two edits after a check).
- `host.jobs.registerExtension` is the one host member the entry names; it is recorded in `docs/plugin-api.md` as an API change. No other new host member; if one is needed, stop and say so.
- `npm test` and `npm run check` pass, and the commits are signed off.
- README's table and `arthur.mmd` show 53 as built.

## Scope

In:
- `packages/delivery`, `packages/core` (`registerExtension` and the wrapper's `-e` list), their docs and tests, README, `arthur.mmd`, `docs/plugin-api.md`;
- `test/structure.test.ts` budgets, raised only after naming what was cut first.

Out:
- entries 54 to 56.

## Decisions

- 2026-10-20: Started by the coordinator under the owner's free hand ("lec ze wszystkim śmiało", 99% usage until 08:00); 52 merged as 7552dfc. The roadmap entry itself names the new host member, so it counts as approved with the roadmap.
