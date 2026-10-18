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

- `spec/roadmap.md`: entry 48 (or 47, whichever owns sending) gains a silent rule with no command to switch it: a coordinator reply to the owner's own message rings (he is waiting for it); a reply the coordinator writes on its own, woken by a job's end, a review or a schedule entry, goes without a notification, unless it reports the delegated work done, its stop condition met (a limit reached), or a decision the owner must make, which the coordinator marks and which rings. Edge cases: a job blocked on the owner rings; quiet hours silence everything, the ringing ones too; the coordinator's role says when to mark a reply as ringing.
- `npm test` and `npm run check` pass.

## Scope

In:
- `spec/roadmap.md` only.

Out:
- Any code: the telegram plugin is not built yet.

## Decisions

- 2026-10-18: The owner asked for a silent mode for the coordinator and for Arthur; proposed by the coordinator.
- 2026-10-18: The owner: silent mode only in Arthur, and not switched by commands such as /quiet and /loud; it follows from who started the turn.
