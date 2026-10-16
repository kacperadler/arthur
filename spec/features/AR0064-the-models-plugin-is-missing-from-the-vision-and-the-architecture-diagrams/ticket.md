# AR0064 - The `models` plugin is missing from the vision and the architecture diagrams

```json
{
  "id": "AR0064",
  "title": "The `models` plugin is missing from the vision and the architecture diagrams",
  "date": "2026-10-16"
}
```

## Description

roadmap entry 82 and `arthur.config.example.ts` add a `models` plugin (marked `first, named`), but the vision's plugin table and both diagrams list every plugin except it; voice (81) was added to all three. This ticket's Scope names only the roadmap and the example config.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: cleanup

Evidence:
- `spec/vision.md:74`, `docs/architecture/versions.mmd:9`, `docs/architecture/core-and-plugins.mmd:15`
- Found by: 2026-10-16-ar0063-providers-and-fal-c8dd47f8 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: one row in the vision's table (`models (named) | first | Models served on the owner's machines, and an ordered fallback per role or kind`), and `models` in the first-version box of `versions.mmd` and in `core-and-plugins.mmd` with its `first` class. Nothing else.
- `npm test` and `npm run check` pass.

## Scope

In:
- one row in the vision's table (`models (named) | first | Models served on the owner's machines, and an ordered fallback per role or kind`), and `models` in the first-version box of `versions.mmd` and in `core-and-plugins.mmd` with its `first` class. Nothing else.

## Decisions

- 2026-10-16: Source: F1 of AR0063
