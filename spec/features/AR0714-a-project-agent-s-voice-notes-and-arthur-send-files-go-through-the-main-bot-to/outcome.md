# AR0714 - Outcome

- Merged: 2026-11-24, `826633c7`
- Branch: arthur/2026-11-23-worker-dabd19ca
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $21.14, reviews $2.14; review rounds 2

## What went in

- docs/plugin-api.md: lists the AR0714 change, `channel.send`'s `{ files, caption?, place?, instance? }` and the new provided name `actor.chat`.
- packages/core/docs/commands/send.md: says where `arthur send` goes in a project agent's session, the new refusal, and the `channel.send` contract with `instance`.
- packages/core/src/host.ts: `channels` is now `{ send, chat }`, `chat` being orchestration's answer to `actor.chat`.
- packages/core/src/send-command.ts: without `--place`, sends to the session's chat alone (its channel, bot and place); refuses a chat whose plugin provides no `channel.send`.
- packages/core/test/cli.test.ts: tests `arthur send` from a project agent's session, with `--place`, from the coordinator's session, a failing send and a chat on a plugin that is no channel.
- packages/discord/docs/discord.md: "Sending files" states the bot by `instance` and that bot's main channel.
- packages/discord/src/discord.ts: `channel.send` sends by the bot `instance` names, else the main one.
- packages/discord/src/media-out.ts: header comment says the caller picks the bot.
- packages/discord/test/media.test.ts: tests `channel.send` by a named bot, with and without a place, and the fallback to the unnamed bot.
- packages/orchestration/docs/commands/coordinator.md: the voice note goes by the reply's bot and place; a project agent's `arthur send` goes to its chat by `actor.chat`.
- packages/orchestration/roles/project.md: tells the agent its `arthur send` files go to its project's chat.
- packages/orchestration/src/orchestration.ts: provides `actor.chat`, the chat of the project agent whose session the process runs in.
- packages/orchestration/src/voice-reply.ts: passes the reply's `instance` with its `place` to `channel.send` and to the "voice note not sent" line.
- packages/orchestration/test/actor.test.ts: tests `actor.chat` in an agent's session, the coordinator's, an unknown agent's folder and outside a session.
- packages/orchestration/test/voice-reply.test.ts: tests the voice note with `place` and `instance`, directly and through the plugin from a project's chat.
- packages/speak/docs/speak.md: says the voice note goes to a project agent's chat by its bot and place.
- packages/telegram/docs/telegram.md: "Sending files" and "Project chats" state the bot by `instance`.
- packages/telegram/src/media-out.ts: header comment says the caller picks the bot.
- packages/telegram/src/telegram.ts: `channel.send` sends by the bot `instance` names, else the main one.
- packages/telegram/test/media.test.ts: tests `channel.send` by a named bot to its chat and topic, and the fallback to the unnamed bot.
- spec/features/AR0714-a-project-agent-s-voice-notes-and-arthur-send-files-go-through-the-main-bot-to/findings.md: F1 to F3, open.
- spec/roadmap.md: entry 86 lists AR0714 and what it delivers.
- test/structure.test.ts: core's line budget 7617, orchestration's 3244.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1860/1931 passed.

## Left open

- Deferred (client summary): F1. The coordinator's voice note goes by the main bot when its text goes by a named bot
- Deferred (client summary): F2. `/retro` and `/repeats` send their page by the main bot, whatever bot the command came through
- Deferred (client summary): F3. A chat whose `instance` names no bot talks through the main bot
- Deferred (client summary): F4. `--place` from a project agent's session on a named bot goes by the main bot
