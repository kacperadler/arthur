# AR0003 - Merge checks of a project that requires another OS run on `local`

```json
{
  "id": "AR0003",
  "title": "Merge checks of a project that requires another OS run on `local`",
  "date": "2026-10-16"
}
```

## Description

entry 31 places every job of a ticket by its labels, so an iOS project's worker and review run on the Mac. Entry 53 still runs install and the project's checks in the main checkout, on `local` (Linux in the example). For a project with `requires: { os: "macos" }` those checks cannot pass there, and a failed check resets main, so such a project can never merge through `arthur merge`.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: risk

Evidence:
- `spec/roadmap.md`, entry 53 (`arthur merge`) and entry 31 (placement by labels)
- Found by: 2026-10-16-ar0002-roadmap-job-state-a365c361 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: decide where a merge's checks run for a project whose `requires` excludes `local`: on a machine with the labels (the merged tree pushed there over SSH, as entry 21 pushes a base commit), or only in CI (`ci.workflow`, with `arthur merge --auto` as the gate). Add it to entry 53's Delivers and Done means; the merge itself stays on `local`.
- `npm test` and `npm run check` pass.

## Scope

In:
- decide where a merge's checks run for a project whose `requires` excludes `local`: on a machine with the labels (the merged tree pushed there over SSH, as entry 21 pushes a base commit), or only in CI (`ci.workflow`, with `arthur merge --auto` as the gate). Add it to entry 53's Delivers and Done means; the merge itself stays on `local`.

## Decisions

- 2026-10-16: Source: F1 of AR0002
