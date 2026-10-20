# AR0225 - A phone command does not learn which named bot it came through

```json
{
  "id": "AR0225",
  "title": "A phone command does not learn which named bot it came through",
  "date": "2026-10-20"
}
```

## Description

`route` passes `{ channel, place }` to a phone command, as roadmap entry 50 says, but not the `instance` (the named bot) that `message-received` carries (AR0211). A project's `chat` key (entry 85) is `{ plugin, instance?, place }`, so `/restart` from a topic of a named bot (entries 36, 88) cannot tell that chat from the same topic number of another bot. The reply itself already goes back by the right bot.

## Goal

A phone command learns the named bot it came through, so `/restart` from a topic of one bot is never taken for the same topic number of another bot's chat. Done before the host API freezes in entry 51: an optional `instance` on `PhoneFrom`, passed from telegram's `receive` as `message-received` already does (`packages/core/src/commands.ts:26`, `packages/telegram/src/poll.ts:84`; F1 of AR0224).

- Kind: risk

Evidence:
- `packages/core/src/commands.ts:26`, `packages/telegram/src/poll.ts:84`
- Found by: 2026-10-20-ar0224-roadmap-50-phone-f10cd1df (worker), 2026-10-20

## Done means

- The fix, with a test that proves it: before the host API freezes (entry 51), add an optional `instance` to `PhoneFrom` and pass the bot's name from telegram's `receive`, as `message-received` does; nothing else changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- before the host API freezes (entry 51), add an optional `instance` to `PhoneFrom` and pass the bot's name from telegram's `receive`, as `message-received` does; nothing else changes.

## Decisions

- 2026-10-20: Source: F1 of AR0224
- 2026-10-20: Approved by the coordinator under the owner's free hand in Arthur.
