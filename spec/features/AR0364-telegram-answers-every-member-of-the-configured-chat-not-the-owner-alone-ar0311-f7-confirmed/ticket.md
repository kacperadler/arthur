# AR0364 - Telegram answers every member of the configured chat, not the owner alone (AR0311 F7, confirmed)

```json
{
  "id": "AR0364",
  "title": "Telegram answers every member of the configured chat, not the owner alone (AR0311 F7, confirmed)",
  "date": "2026-10-23"
}
```

## Description

Two or three sentences: what changes, and for whom.

## Goal

The Telegram bot acts only on messages its owner wrote (`from.id`, no `sender_chat`), and the config refuses a group chat id; tested.

- Kind: risk

Evidence:
- `packages/telegram/src/poll.ts:56` (only `message.chat.id` and `date` are compared; `message.from` and `message.sender_chat` are never read), `packages/telegram/src/telegram.ts:89` (a negative chat id is accepted at load, its message calling it "negative for a group"), `packages/telegram/docs/telegram.md:13` (asks for "the owner's private chat with it") against `:16` ("negative for a group"), `packages/telegram/test/telegram.test.ts:50` (asserts that a group id is accepted), `packages/telegram/src/telegram-options.ts:17` (`chatIdEnv`, no owner id)
- Found by: 2026-10-23-ar0325-security-check-6f2cfa6c (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: the smallest fix, since the docs already promise a private chat: in `bot()` (`telegram.ts:89`) refuse a chat id that is not a positive whole number, with `… does not hold a chat id: the owner's private chat with the bot, a positive whole number`, and in `poll.ts:56` also skip a message whose `from.id` is not `bot.chat` or that carries `sender_chat` (a second line, for a Telegram shape nobody foresaw). Tests: `telegram.test.ts:38` turns the line-50 assertion into a refusal of `-1001234567890`; `telegram.test.ts:73` gains a message of the right chat with another `from.id`, and one with `sender_chat`, both dropped unanswered. Docs: `telegram.md:16` and the `chatIdEnv` `about` (`telegram-options.ts:17`) say a positive id, the owner's private chat. If a group chat is wanted later (a project's chat with topics), that is its own ticket with an `ownerIdEnv` per bot, required when the chat id is negative, and the same `from.id` check against it; not part of this fix.
- `npm test` and `npm run check` pass.

## Scope

In:
- the smallest fix, since the docs already promise a private chat: in `bot()` (`telegram.ts:89`) refuse a chat id that is not a positive whole number, with `… does not hold a chat id: the owner's private chat with the bot, a positive whole number`, and in `poll.ts:56` also skip a message whose `from.id` is not `bot.chat` or that carries `sender_chat` (a second line, for a Telegram shape nobody foresaw). Tests: `telegram.test.ts:38` turns the line-50 assertion into a refusal of `-1001234567890`; `telegram.test.ts:73` gains a message of the right chat with another `from.id`, and one with `sender_chat`, both dropped unanswered. Docs: `telegram.md:16` and the `chatIdEnv` `about` (`telegram-options.ts:17`) say a positive id, the owner's private chat. If a group chat is wanted later (a project's chat with topics), that is its own ticket with an `ownerIdEnv` per bot, required when the chat id is negative, and the same `from.id` check against it; not part of this fix.

## Decisions

- 2026-10-23: Source: F1 of AR0325
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
