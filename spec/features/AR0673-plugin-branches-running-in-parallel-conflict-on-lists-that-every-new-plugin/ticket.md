# AR0673 - Plugin branches running in parallel conflict on lists that every new plugin appends to, so each later merge needs a merge of main and a budget raise

```json
{
  "id": "AR0673",
  "title": "Plugin branches running in parallel conflict on lists that every new plugin appends to, so each later merge needs a merge of main and a budget raise",
  "date": "2026-11-10",
  "budget": 4
}
```

## Description

Plugin branches built at the same time stop conflicting on the lists every new plugin appends to, so a later merge needs no merge of main and no extra budget.

## Goal

AR-D590/AR-D591 run 3 jobs at once, so every pair of parallel plugin tickets now pays for a continue, a merge of main and a rerun of the checks. The hand-kept status line also goes stale whatever the rules say, as the README's did before AR0659.

Evidence (audit 2026-11-10):
- `git merge-tree` between today's three plugin branches. Every pair conflicts:
  - AR0645 (docker) × AR0553 (speak): `arthur.config.example.ts`, `arthur.mmd`, `test/option-tables.test.ts`.
  - AR0645 × AR0670 (herdr): `README.md`, `arthur.config.example.ts`, `test/option-tables.test.ts`.
  - AR0553 × AR0670: `arthur.config.example.ts`, `test/option-tables.test.ts`.
- `test/option-tables.test.ts:64-88`: `PLUGINS` is in no order, and new entries go at the end (activity after stats). The expected lists at `:108` and `:116` are single array literals that each branch extends at the same spot.
- `arthur.mmd`: three lines hold every plugin at once:
  - `:3` is one status line over all plugins, at the 768-character limit of my reader's line display.
  - `:153` is one 299-character `class` line for all built nodes.
  - `:154-155` hold the partial and planned nodes.
  - AR0645 edits lines 154-155 and AR0553 edits line 153, so Git conflicts on these adjacent lines.
- `arthur.config.example.ts:1-5`: a hand-kept, wrapped list of every package, so adding one name reflows the whole paragraph.
- Past cost:
  - AR-D543: AR0644 +$4, conflicts in `docs/plugin-api.md` and `test/structure.test.ts`.
  - AR-D544: AR0650 +$3, conflict in `arthur.mmd`.
  - AR-D546: AR0635 +$2, conflict in `test/structure.test.ts`.
  - AR-D547: AR0644 +$3, `arthur.mmd` again.
- `arthur.mmd:3` has also drifted:
  - It lists no core entry 99, 104 or 108, although AR0528, AR0640 and AR0649 are merged.
  - It ends "no other plugin exists yet", while `packages/activity` exists.
  - The same drift was filed as AR0592's finding and AR0650 F2.

- Kind: chore

## Done means

- `test/option-tables.test.ts`: `PLUGINS` in name order, and both expected lists keyed by plugin, one line each in name order, as `BUDGETS` is; the test's assertions are unchanged.
- `arthur.mmd`: the hand-kept status line and dates go; one `class <node> <state>;` line per node.
- `arthur.config.example.ts`: the package list in its header becomes a pointer to `packages/`.
- `git merge-tree` of two branches that each add a plugin to these three files in the new form shows no conflict (stated in the outcome); `npm run check` and `npm test` pass on the clean tip.

## Scope

In:
- `test/option-tables.test.ts`: `PLUGINS` in name order. The two expected lists become keyed by plugin, one line each, in name order with a blank line between entries, as `BUDGETS` already is (`plugin-new.ts:96`).
- `arthur.mmd`:
  - Drop line 3, line 1's date and the legend's date. The roadmap page computes what is built (AR0634).
  - One `class <node> <state>;` line per node.
- `arthur.config.example.ts:1-5`: replace the package list with a pointer to `packages/`.

Out:
- the README's Features list, `BUDGETS`, and the diagram's content.

## Decisions
- 2026-11-10: Source: audit spec/quality/2026-11-10.md
- 2026-11-10: AR0673 approved; the owner: "approve all five" (AR-D610)
