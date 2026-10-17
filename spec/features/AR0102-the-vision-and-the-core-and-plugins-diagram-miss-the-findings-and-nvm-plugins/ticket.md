# AR0102 - The vision and the core-and-plugins diagram miss the `findings` and `nvm` plugins

```json
{
  "id": "AR0102",
  "title": "The vision and the core-and-plugins diagram miss the `findings` and `nvm` plugins",
  "date": "2026-10-17"
}
```

## Description

the roadmap plans a `findings` plugin (entry 83) and an `nvm` plugin (entry 84), both outside its Later section. The vision's plugin table names `nvm` but not `findings`. `docs/architecture/core-and-plugins.mmd` names neither. `arthur.mmd` shows both, so the three pictures of the plugin list disagree. AR0064 closed the same gap for `models`.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: cleanup

Evidence:
- `spec/vision.md:64` (the plugin table), `docs/architecture/core-and-plugins.mmd`
- Found by: 2026-10-17-ar0101-diagram-fb43a273 (worker), 2026-10-17

## Done means

- The fix, with a test that proves it: add a `findings` row to the vision's plugin table, and `nvm` and `findings` boxes to `core-and-plugins.mmd`. Leave the roadmap as it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- add a `findings` row to the vision's plugin table, and `nvm` and `findings` boxes to `core-and-plugins.mmd`. Leave the roadmap as it is.

## Decisions

- 2026-10-17: Source: F1 of AR0101
