# AR0249 - The vision still says `ci-finished` is keyed by run id

```json
{
  "id": "AR0249",
  "title": "The vision still says `ci-finished` is keyed by run id",
  "date": "2026-10-21"
}
```

## Description

AR0238 keys what is told by `<run id>/<run_attempt>`, and roadmap entry 57 now says "once per run attempt"; the vision, which is the owner's, still says "emits `ci-finished` once per run, keyed by run id".

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: cleanup

Evidence:
- `spec/vision.md:109` ("GitHub without webhooks")
- Found by: 2026-10-21-ar0246-roadmap-58-github-56fccda8 (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: the owner rewords that sentence to "once per run attempt (a rerun keeps the run's id)".
- `npm test` and `npm run check` pass.

## Scope

In:
- the owner rewords that sentence to "once per run attempt (a rerun keeps the run's id)".

## Decisions

- 2026-10-21: Source: F2 of AR0246
