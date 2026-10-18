# AR0127 - Roadmap: a silent mode for the coordinator in the channels

```json
{
  "id": "AR0127",
  "title": "Roadmap: a silent mode for the coordinator in the channels",
  "date": "2026-10-18"
}
```

## Description

The owner wants to delegate a stretch of work and be notified only when it is done, its stop condition is met, or a decision is needed. The roadmap has quiet hours (entry 7) but no silent mode the owner turns on.

## Goal

The plan for the telegram plugin (entry 47 or 48) includes a silent mode before it is built.

- Kind: improvement
- Model: haiku

## Done means

- `spec/roadmap.md`: entry 48 (or 47, whichever owns the phone menu) gains: `/quiet` and `/loud` set a silent mode stored under the home folder, surviving a restart; while on, every message goes without a notification except one the coordinator marks as ringing (work done, stop condition met, a decision needed); the coordinator's role says when to mark one. Edge cases: a notice from a plugin (a job blocked on the owner) rings; quiet hours still silence a ringing one.
- `npm test` and `npm run check` pass.

## Scope

In:
- `spec/roadmap.md` only.

Out:
- Any code: the telegram plugin is not built yet.

## Decisions

- 2026-10-18: The owner asked for a silent mode for the coordinator and for Arthur; proposed by the coordinator.
