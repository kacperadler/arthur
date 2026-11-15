# AR0706 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A project agent's voice note goes by the main bot, not its chat's bot

- Kind: fix
- Found by: 2026-11-14-worker-8a88fde0 (worker), 2026-11-14
- Where: `packages/orchestration/src/voice-reply.ts:32`, `packages/telegram/src/telegram.ts:73`, `packages/discord/src/discord.ts:91`
- What: the voice note of a project agent's reply now goes to its chat's `place` (AR0706), but `channel.send` in telegram and discord always sends by the main bot (`outgoing(main, ...)`). For an agent whose chat names a bot `instance`, the topic or channel id is that bot's, so Telegram is asked to send to the main bot's chat with another chat's `message_thread_id` [INFERENCE: it refuses it; not run against Telegram]; the owner then gets `voice note not sent: <Telegram's refusal>` in the agent's topic instead of the voice note. Reproduce: a project with `chat: { plugin: "telegram", instance: "shop", place: "42" }`, the speak plugin on, a voice note in topic 42.
- Suggestion: voice-reply.ts passes the reply's `instance` to `channel.send` (`{ files, place, instance }`), and telegram's and discord's `channel.send` pick the bot by `instance` as their replies do now; `arthur send` keeps the main bot.
- Status: deferred (client summary)

## F2. The activity log does not show `agent-told`

- Kind: feat
- Found by: 2026-11-14-worker-8a88fde0 (worker), 2026-11-14
- Where: `packages/activity/src/activity-line.ts:38`
- What: `arthur agent tell` emits `agent-told` `{ to, from, text }` (AR0706), which the activity plugin's `TEXTS` does not list, so `arthur log` never shows that the coordinator handed a project agent work, or an agent the coordinator.
- Suggestion: add `"agent-told": (data) => \`${data.from} -> ${data.to}: ${data.text}\`` to `TEXTS`, with its row in `packages/activity/test/activity-line.test.ts` and `packages/activity/docs/activity.md`.
- Status: deferred (client summary)

## F3. Uptime's down and up notices go to every channel's main place, not the project agent's chat

- Kind: feat
- Found by: 2026-11-14-worker-8a88fde0 (worker), 2026-11-14
- Where: `packages/uptime/src/uptime.ts:90`, `packages/uptime/src/uptime.ts:100`
- What: AR0706 routes uptime's `coordinator-message` to the project's agent by its `project`, but the `notice` uptime emits beside it names no chat, so the owner reads a site of a project with an agent going down in the main chat while the agent works on it in the project's chat.
- Suggestion: a notice about a project could name it (`project`), and orchestration answer the chat of a project (`orchestration.chats` exists) so a channel sends it to that place; or uptime asks `orchestration.chats` itself. Out: the blocked-job and decision notices, which already carry the chat.
- Status: deferred (client summary)
