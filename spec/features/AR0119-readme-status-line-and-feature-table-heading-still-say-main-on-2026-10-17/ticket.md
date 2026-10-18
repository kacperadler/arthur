# AR0119 - README status line and feature table heading still say "main on 2026-10-17"

```json
{
  "id": "AR0119",
  "title": "README status line and feature table heading still say \"main on 2026-10-17\"",
  "date": "2026-10-18"
}
```

## Description

the status line and the feature table's intro still date the state "main on 2026-10-17", though entries 24 and 26 merged on 2026-10-17 and 2026-10-18 changed the feature table. This ticket changed only the two lists (`README.md:33-40`), as its last Decision sets.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: cleanup

Evidence:
- `README.md:29`, `README.md:44` (and the `arthur.mmd` copy in the README block, its legend and its comment)
- Found by: 2026-10-18-ar0114-readme-lists-7e62df1e (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: refresh the dates from `spec/build.json` in one change with `arthur.mmd` (the structure test keeps the README block equal to it).
- `npm test` and `npm run check` pass.

## Scope

In:
- refresh the dates from `spec/build.json` in one change with `arthur.mmd` (the structure test keeps the README block equal to it).

## Decisions

- 2026-10-18: Source: F1 of AR0114
- 2026-10-18: Dropped by the coordinator: the README date is refreshed with the next feature-table change.
