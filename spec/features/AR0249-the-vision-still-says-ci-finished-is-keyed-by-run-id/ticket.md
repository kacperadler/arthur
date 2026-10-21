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

The vision says `ci-finished` is told once per run attempt; the owner approved the wording on 2026-10-21 and the coordinator applied it.

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
- 2026-10-21: Approved by the owner (Telegram).
- 2026-10-21: Applied in spec/vision.md line 109 by the coordinator on the owner`s approval.
