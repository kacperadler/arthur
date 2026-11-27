# AR0747 - A project chat that misspells its bot silently uses the main bot, so its agent never hears the owner

```json
{
  "id": "AR0747",
  "title": "A project chat that misspells its bot silently uses the main bot, so its agent never hears the owner",
  "date": "2026-11-27",
  "budget": 5
}
```

## Description

A project's chat names the bot it talks through; a name no bot has falls back to the main bot, so the project's agent never gets the owner's messages there and its replies land in the main chat. After this change `arthur run` refuses to start on such a chat, in Telegram and in Discord, naming the project and the bots that exist.

## Goal

One typo in a `project.config.ts` leaves a project agent unable to hear the owner. Its replies go through the main bot into the main chat, and `arthur run` starts as if nothing were wrong.

Evidence (audit 2026-11-27, F3 of AR0714):

- `packages/telegram/src/telegram.ts:50` and `packages/discord/src/discord.ts:58`: `named(instance)` falls back to the main bot for a name that no bot has.
- `packages/orchestration/src/sessions.ts:52`: incoming messages are matched on `chat.instance === to.instance`. A misspelled name never matches, so every message in that chat goes to the coordinator.
- `packages/orchestration/src/orchestration.ts:113-129`: the critical `chat of <project>` doctor line refuses a chat whose plugin has no `channel.send`, but never checks the bot name.
- Telegram's `missing: no bot named <instance> in bots` (`telegram.ts:106`) is not critical (`packages/telegram/test/telegram.test.ts:497`). Discord has no such line.

- Kind: fix

## Done means

1. In telegram, a project chat naming a bot that `bots` does not have gives a critical doctor line naming the project and the bots that exist; the row at `packages/telegram/test/telegram.test.ts:497` asserts it critical and fails on main today.
2. In discord, the same chat gives the same critical line; a new row in `packages/discord/test/discord.test.ts` fails on main today.
3. A chat naming an existing bot, or naming none, gives no such line.
4. The fallback in `named` stays, for a bot removed while messages are still queued.
5. `npm test` and `npm run check` pass.

## Scope

In:
- `packages/telegram/src/telegram.ts`: the doctor line becomes critical and names the project and the bots.
- `packages/discord/src/discord.ts`: the same line, new.
- `packages/telegram/test/telegram.test.ts`, `packages/discord/test/discord.test.ts`: the rows of Done means 1 to 3.

Out:
- AR0714's F1, F2 and F4.

## Decisions

- 2026-11-27: Source: audit spec/quality/2026-11-27.md
- 2026-11-27: Source: F3 of AR0714
