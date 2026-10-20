# AR0223 - A restart between a part claim reply and the inbox queue sends the reply twice

```json
{
  "id": "AR0223",
  "title": "A restart between a part claim reply and the inbox queue sends the reply twice",
  "date": "2026-10-20"
}
```

## Description

When a plugin claims a part of an owner's message (a voice note transcribed, for example) and replies, the reply is sent before the message is queued for the coordinator. If `arthur run` restarts in between, the message is resolved again at the next start and the owner gets the reply twice.

## Goal

Each claim's reply reaches the owner once, whatever moment `arthur run` stops. Evidence: `packages/orchestration/src/inbox.ts`, `turnText` emits `coordinator-replied` before the message leaves `inbox/received/` (AR0221 F1, review-1 of AR0221).

- Kind: bug

## Done means

- A test stops the inbox after a claim's reply was emitted and before the message was queued, starts it again, and the owner's channel gets the reply once and the coordinator the message once.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/orchestration/src/inbox.ts` and its tests.

Out:
- The parts contract in the core.

## Decisions

- 2026-10-20: Source: F1 of AR0221
- 2026-10-20: The owner approved it (87% usage, under the 90% ceiling).
- 2026-10-20: The coordinator accepts the orchestration line budget raise 1427 -> 1433 (+6) for the fix.
