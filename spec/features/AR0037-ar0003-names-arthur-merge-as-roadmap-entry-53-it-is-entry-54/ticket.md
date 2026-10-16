# AR0037 - AR0003 names `arthur merge` as roadmap entry 53; it is entry 54

```json
{
  "id": "AR0037",
  "title": "AR0003 names `arthur merge` as roadmap entry 53; it is entry 54",
  "date": "2026-10-16"
}
```

## Description

AR0003's Evidence, Done means and Scope say "entry 53 (`arthur merge`)" and "Add it to entry 53's Delivers and Done means". In `spec/roadmap.md`, entry 53 is `arthur review-needed` and `arthur merge` is entry 54 (AR0002's own Decision says 54). A worker following AR0003 literally edits the wrong entry.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: cleanup

Evidence:
- `spec/features/AR0003-merge-checks-of-a-project-that-requires-another-os-run-on-local/ticket.md:22`, `:27`, `:33`
- Found by: 2026-10-16-ar0034-disk-and-docker-c-1cb169d7 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: change the three mentions in AR0003 to entry 54. Nothing else; AR0034 kept entries 1 to 68 at their numbers, so the fix stays valid.
- `npm test` and `npm run check` pass.

## Scope

In:
- change the three mentions in AR0003 to entry 54. Nothing else; AR0034 kept entries 1 to 68 at their numbers, so the fix stays valid.

## Decisions

- 2026-10-16: Source: F1 of AR0034
