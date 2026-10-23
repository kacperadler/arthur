# AR0286 - The coordinator's role has no rule for a night answer, which orchestration/night-one-line measures

```json
{
  "id": "AR0286",
  "title": "The coordinator's role has no rule for a night answer, which orchestration/night-one-line measures",
  "date": "2026-10-22"
}
```

## Description

the predecessor's role said "Keep night replies to one line"; Arthur's role says nothing about night replies, though the example config promises it. The scenario `orchestration/night-one-line` (roadmap 68) expects a one-line reply at night, so it measures a rule the coordinator is never given.

## Goal

The coordinator's role says how to answer at night (one line), so the night-one-line eval measures a rule that exists.

- Kind: fix

Evidence:
- `packages/orchestration/roles/coordinator.md` ("Final message"); `arthur.config.example.ts` (`quietHours`: "the coordinator answers in one line")
- Found by: 2026-10-22-ar0280-eval-scenarios-4e8abbcc (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: one line in the role's Final message: at night (the context's `## Time` says so), the reply is one line. Out: the context's time in an eval run (AR0279).
- `npm test` and `npm run check` pass.

## Scope

In:
- one line in the role's Final message: at night (the context's `## Time` says so), the reply is one line. Out: the context's time in an eval run (AR0279).

## Decisions

- 2026-10-22: Source: F1 of AR0280
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
