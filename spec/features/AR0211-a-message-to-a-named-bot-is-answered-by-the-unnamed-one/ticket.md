# AR0211 - A message to a named bot is answered by the unnamed one

```json
{
  "id": "AR0211",
  "title": "A message to a named bot is answered by the unnamed one",
  "date": "2026-10-19"
}
```

## Description

with several bots, every bot's messages reach the coordinator as `{ channel: "telegram", text }`, but the replies and notices go only from the unnamed bot (else the first) to its chat, since neither `message-received` nor `coordinator-replied` says which bot a message came through. The owner writing to a second bot gets the answer in the first bot's chat.

## Goal

A message sent to a named bot is answered by that same bot.

- Kind: feat

Evidence:
- `packages/telegram/src/telegram.ts` (`main`), `packages/orchestration/src/inbox.ts` (`queue`)
- Found by: 2026-10-19-ar0208-telegram-29caf33c (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: when entries 85 and 86 bind a named bot to a project's chat, carry the bot (an instance) with the message and its reply, as `place` is carried; until then the docs say the unnamed bot sends.
- `npm test` and `npm run check` pass.

## Scope

In:
- when entries 85 and 86 bind a named bot to a project's chat, carry the bot (an instance) with the message and its reply, as `place` is carried; until then the docs say the unnamed bot sends.

## Decisions

- 2026-10-19: Source: F2 of AR0208
- 2026-10-19: Approved under the owner's word of the same day: findings are built in batches or with the roadmap entry that touches the same files.
