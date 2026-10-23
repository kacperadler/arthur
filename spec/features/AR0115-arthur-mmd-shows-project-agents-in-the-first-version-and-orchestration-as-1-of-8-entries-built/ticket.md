# AR0115 - arthur.mmd shows project agents in the first version, and orchestration as 1 of 8 entries built

```json
{
  "id": "AR0115",
  "title": "arthur.mmd shows project agents in the first version, and orchestration as 1 of 8 entries built",
  "date": "2026-10-18"
}
```

## Description

the roadmap now places project agents (85 to 88) first among the later entries, but `arthur.mmd` draws the `agents` box inside "First-version plugins", in the Coordinator group. The same diagram and the README's feature table still say orchestration has entry 23 of 8 built ("1 of 8 entries", "23 built; 24 to 29, 65"), though AR0084 (entry 24) and AR0110 (entry 26) are merged.

## Goal

The diagram and the README show a newcomer what is built and what comes later. It covers AR0114 too (the same README row), so AR0114 can be dropped.

- Kind: refactor
- Model: haiku

Evidence:
- `arthur.mmd:49-54` and `:3`, its copy in `README.md`, and `README.md:63`
- Found by: 2026-10-17-ar0098-project-agents-160d388f (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: move `agents` into "Later plugins" (first in its row), refresh the built counts and the legend's date from `spec/build.json`, and copy `arthur.mmd` into the README block (the structure test checks they match). Leave the roadmap alone.
- `npm test` and `npm run check` pass.

## Scope

In:
- move `agents` into "Later plugins" (first in its row), refresh the built counts and the legend's date from `spec/build.json`, and copy `arthur.mmd` into the README block (the structure test checks they match). Leave the roadmap alone.

## Decisions

- 2026-10-18: Source: F1 of AR0098
- 2026-10-18: The owner approved it.
