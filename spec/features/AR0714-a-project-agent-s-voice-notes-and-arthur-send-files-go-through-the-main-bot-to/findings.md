# AR0714 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The coordinator's voice note goes by the main bot when its text goes by a named bot

- Kind: fix
- Found by: 2026-11-23-worker-dabd19ca (worker), 2026-11-23
- Where: `packages/orchestration/src/voice-reply.ts:19`, `packages/telegram/src/telegram.ts:52`, `packages/discord/src/discord.ts:60`
- What: a voice note the owner sends in a named bot's main chat reaches the coordinator. Its text reply goes by that bot, since `through(answers, instance)` reads the bot of the answered message from the event log; the reply itself carries no `instance`, so voice-reply.ts passes none to `channel.send` and the voice note goes by the main bot, to the main chat. The ticket's Scope leaves the coordinator's behaviour as it is. Read in the code, not run with two bots.
- Suggestion: voice-reply.ts already reads each answered `message-received`; send one voice note per channel and `instance` of those messages, with that `instance`, when the reply names none.
- Status: deferred (client summary)

## F2. `/retro` and `/repeats` send their page by the main bot, whatever bot the command came through

- Kind: fix
- Found by: 2026-11-23-worker-dabd19ca (worker), 2026-11-23
- Where: `packages/manage/src/retro.ts:77`
- What: the page goes as `{ files, place }`, the `place` the phone command came from, without the `instance` a phone command's `from` holds. From a topic of a named bot's chat the page is sent by the main bot with that topic's number, the case this ticket fixes for a project agent. The ticket's Scope leaves the retro's send as it is. Read in the code, not run.
- Suggestion: add `from.instance` to the message when it is set; `channel.send` takes it since AR0714. One line, with a row in `packages/manage/test/retro.test.ts`.
- Status: deferred (client summary)

## F3. A chat whose `instance` names no bot talks through the main bot

- Kind: fix
- Found by: 2026-11-23-worker-dabd19ca (worker), 2026-11-23
- Where: `packages/telegram/src/telegram.ts:50`, `packages/discord/src/discord.ts:58`, `packages/telegram/src/telegram.ts:79`
- What: `named(instance)` answers the main bot for a name no bot has, so a project whose `orchestration.project({ chat })` misspells its bot gets its replies, notices, voice notes and `arthur send` files sent by the main bot with the chat's place (the tests `channel.send: by the bot its instance names ...` in telegram and `send: by the bot its instance names ...` in discord show it for files), and its agent never hears the owner. Telegram's `arthur doctor` line says `missing: no bot named <instance> in bots` but is not critical; discord has no such line.
- Suggestion: make that line critical in telegram and add it to discord, so `arthur run` does not start with such a chat; the fallback in `named` can then stay for a bot removed while slices wait.
- Status: ticket AR0747

## F4. `--place` from a project agent's session on a named bot goes by the main bot

- Kind: fix
- Found by: 2026-11-24-review-953209e8 (review), 2026-11-24
- Where: `packages/core/src/send-command.ts:33`
- What: With `--place`, the chat is ignored and every channel's main bot sends to that place. An agent that passes its own topic number recreates the bug this ticket fixes: the main bot's chat with the agent's topic. `send.md` documents this and the role never tells the agent its place, so it only happens through a slip.
- Status: deferred (client summary)
