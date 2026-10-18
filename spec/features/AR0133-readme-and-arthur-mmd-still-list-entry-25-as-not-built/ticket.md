# AR0133 - README and arthur.mmd still list entry 25 as not built

```json
{
  "id": "AR0133",
  "title": "README and arthur.mmd still list entry 25 as not built",
  "date": "2026-10-18"
}
```

## Description

both count an entry as built once its ticket is merged, so they were left as they are on this branch.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: cleanup

Evidence:
- `README.md` (Status, What is next, the orchestration row), `arthur.mmd` (orchestration "3 of 8 entries")
- Found by: 2026-10-18-ar0120-coordinator-conte-623670be (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: after the merge, orchestration is 4 of 8 entries (23 to 26 built), and the coordinator's line in "What works today" gains its context on every turn.
- `npm test` and `npm run check` pass.

## Scope

In:
- after the merge, orchestration is 4 of 8 entries (23 to 26 built), and the coordinator's line in "What works today" gains its context on every turn.

## Decisions

- 2026-10-18: Source: F2 of AR0120
- 2026-10-18: Dropped: AR0121 (entry 27) touches the same README rows and shows entry 25 built.
