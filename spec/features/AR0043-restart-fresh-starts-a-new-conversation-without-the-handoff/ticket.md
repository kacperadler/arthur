# AR0043 - `/restart fresh` starts a new conversation without the handoff

```json
{
  "id": "AR0043",
  "title": "`/restart fresh` starts a new conversation without the handoff",
  "date": "2026-10-16"
}
```

## Description

after this ticket, compaction (35) and the nightly fresh start (36) write `.arthur/session/handoff.md` first and the next conversation reads it; `/restart fresh` still starts a new conversation (no `--continue`) with only `after-restart.md`, which holds steps for the human's `Restarted.` message, not the coordinator's work in progress or its unanswered questions. A question to the human asked before `/restart fresh` is lost, which is what the Goal of AR0041 rules out for the other two paths.

## Goal

Every way the coordinator's conversation ends (compaction, the nightly fresh start, `/restart`, `/restart fresh`) keeps its work in progress and unanswered questions, so no question to the human is lost.

- Kind: improvement
- Model: haiku

Evidence:
- `spec/roadmap.md:342` (entry 36)
- Found by: 2026-10-16-r0041-session-handoff-ro-c1afd10a (worker), 2026-10-16

## Done means

- `spec/roadmap.md` entry 36: `/restart` and `/restart fresh` first ask the coordinator for the same handoff (`.arthur/session/handoff.md`) and the new conversation starts by reading it; `after-restart.md` stays the steps for the `Restarted.` message. A handoff not written in time: the restart goes on and says `handoff not written` in the `Restarted.` message, so nothing is silently lost. Edge cases: a coordinator that is not running (no handoff asked); a handoff older than the last one read (not read again).
- `npm test` and `npm run check` pass. English only.

## Scope

In:
- `spec/roadmap.md` entry 36, `spec/vision.md` if it describes restarts.

Out:
- Code.

## Decisions

- 2026-10-16: Source: F1 of AR0041
