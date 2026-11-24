# AR0714 - A project agent's voice notes and arthur send files go through the main bot to the main chat, not to its own chat

```json
{
  "id": "AR0714",
  "title": "A project agent's voice notes and arthur send files go through the main bot to the main chat, not to its own chat",
  "date": "2026-11-17",
  "budget": 5
}
```

## Description

A project agent's text replies reach its own chat, but its spoken replies and the files it shows with `arthur send` do not: the voice note goes through the main bot with the agent's topic number, and `arthur send` goes to the coordinator's main chat. After this, both go to the agent's own chat, through its own bot.

## Goal

Project agents are meant to talk to the owner in the project's own chat (vision decision 20). Today their files and spoken replies land in the coordinator's chat or in the wrong topic.

Evidence (audit 2026-11-17):
- `packages/orchestration/src/voice-reply.ts:19,32`: the voice note is sent as `{ files: [spoken], place }`, with no bot.
- `packages/telegram/src/telegram.ts:73` and `packages/discord/src/discord.ts:91`: `channel.send` always calls `outgoing(main, …)`, so for a project chat on a second Telegram bot the voice note goes to the main bot's chat with the agent's topic number. Text replies are routed by `through(answers, instance)` and are not affected.
- `packages/orchestration/roles/project.md:32` tells the agent to show files with `arthur send <file>… --caption '<text>'`, with no place; `packages/core/src/send-command.ts:26` sends to every channel's allowed chat, the coordinator's main chat. `packages/orchestration/src/context.ts` never tells the agent its own place, and `arthur send` cannot name a bot.

- Kind: fix

## Done means

- `channel.send` in telegram and discord takes an optional `instance` and sends through that bot; without it, the main bot as today.
- A project agent's voice reply goes through the bot and place its text reply goes to; a test per channel and one in orchestration show it, each failing before the change.
- `arthur send` run from a project agent's session sends to that agent's chat (bot and place); from the coordinator's session it sends as today; a test shows both.
- `docs/commands/send.md` and each channel's doc state the `channel.send` contract with `instance`.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/telegram/src/telegram.ts`, `packages/discord/src/discord.ts`: `channel.send` takes `instance`.
- `packages/orchestration/src/voice-reply.ts`: passes the reply's bot and place.
- `packages/core/src/send-command.ts`, or the orchestration side it asks: `arthur send` from a project agent goes to its chat.
- `docs/commands/send.md` and the telegram and discord docs.
- Their tests.

Out:
- The retro's send and the coordinator's behaviour, which stay as they are.

## Decisions

- 2026-11-17: Source: audit spec/quality/2026-11-17.md
- 2026-11-17: Source: F1 of AR0706
- 2026-11-23: AR0714 approved: a project agent voice replies and sent files go to its own chat, budget $10; the owner: "PG-D177 PG-D178 AR-D703 AR-D704 AR-D705 AR-D706 AR-D707 KA-D37 yes" (AR-D704)
- 2026-11-23: AR0714 budget raised from $10 to $20; it finishes on the same branch; the owner: "AR-D709 1, AR-D708 1, AR-D711 1" (AR-D708)
- 2026-11-24: Merge AR0714; the owner: "AR-D716 1, AR-D717 1, PG-D184 1, PG-D182 1, AR-D718 1, AR-D719 1, AR-D720 1, PG-D183 1, ZF-D95 1, ZF-D107 2, ZF-D72 2" (AR-D717)
- 2026-11-24: AR0714 budget raised from $20 to $25; it commits its staged merge, reruns the checks and merges after a re-review; the owner: "AR-D722 1" (AR-D722)
