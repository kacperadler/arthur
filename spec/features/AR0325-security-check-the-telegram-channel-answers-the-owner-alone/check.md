# AR0325 - Check: the Telegram channel answers the owner alone

The rule of this area: the Telegram channel acts only on the owner's own user id, in the configured chat; commands that stop, merge, restart or spend are the owner's alone.

What enforces it: one check, in the poll loop (`packages/telegram/src/poll.ts:56`): an update's `message` whose `chat.id` is not the bot's configured chat, or whose `date` is missing or more than 10 minutes before Arthur's clock, is skipped before anything is fetched, routed or emitted. The code states its assumption itself: "A message of the bot's own chat, at most 10 minutes old, is the owner's" (`poll.ts:7`). The configured chat is the value of `chatIdEnv` (`packages/telegram/src/telegram.ts:88-89`), which the docs describe as "the owner's private chat with it" (`packages/telegram/docs/telegram.md:13`). Nothing downstream looks at the sender again: `PhoneFrom` carries channel, place and instance only (`packages/core/src/commands.ts:26`), and the coordinator reads every `[via <channel>]` message as "the owner writing from a channel" (`packages/orchestration/roles/coordinator.md:12`). So the chat check is the whole boundary between any Telegram user and the owner's word, for messages to the coordinator (which can ask for a merge or a new job) as much as for the phone commands.

How each row was checked: by reading the lines named, by the tests named, and by a throwaway test (not committed) in `packages/telegram/test/` against the package's own fake Bot API (`fake-bot-api.ts`), which pushed messages of the shapes Telegram's Bot API documents (`from`, `sender_chat`, `forward_origin`, a `supergroup` chat) and recorded what reached the fake host and what the bot sent back. Nothing ran against the VPS, the owner's bot, a real token or a client repository; no exploit code.

Verdicts: `holds`, `holds without a test`, `gap` (a `findings.md` entry each), or a pointer to the area whose ticket carries it.

## Who the bot listens to

| Rule | Enforced at | Test | Verdict |
| --- | --- | --- | --- |
| A message of any chat but the configured one is dropped: nothing reaches the coordinator, no reply goes back, and nothing of it is fetched (no `getFile`, no download) | `poll.ts:56` (`continue` before `receive` and `parts`) | `telegram.test.ts:73` "a message of another chat is ignored, unanswered; …" (a stranger's text and sticker: `received()` empty, `api.sent()` empty) | holds (probe: a stranger's photo in another chat, 0 `getFile` calls) |
| The sender is the owner: the message's `from.id` is the owner's user id | nothing: `message.from` is never read (`poll.ts:53-56`, `:78`); `PhoneFrom` has no sender (`commands.ts:26`) | none | **gap**: F1 (AR0311 F7 confirmed). In a private chat `chat.id` is the user's id, so with a positive chat id the chat check is the user check by Telegram's shape; with a negative chat id (a group, a supergroup) every member passes: probe, another member's text reached the coordinator as `[via telegram]` |
| The configured chat is the owner's private chat with the bot | `telegram.ts:89` accepts a negative id and names it: "a whole number, negative for a group"; `telegram.md:13` says "the owner's private chat with it", `telegram.md:16` "negative for a group" | `telegram.test.ts:38`, line 50 asserts that `-1001234567890` is accepted ("a group's id is negative") | **gap**: F1. The docs contradict themselves, and the test pins the group id as accepted |
| A message sent on behalf of a chat (`sender_chat`: an anonymous group admin, a channel's post in its linked group) is not the owner's | nothing: `sender_chat` is never read | none | **gap**: F1 (probe: an anonymous admin's `/stopall` in a configured group ran and was answered) |
| Only `message` updates are polled: no `edited_message`, `channel_post`, `callback_query`, `business_message`, `chat_member`; an update without `message` is skipped | `poll.ts:37` (`allowed_updates: ["message"]`), `:55` (`update.message` only) | `telegram.test.ts:53`, line 58 pins the poll's parameters | holds (no test pushes a stray update of another kind; the code reads `update.message` and nothing else) |
| A message older than 10 minutes, or one without a `date`, is dropped, so a backlog after a downtime does not replay | `poll.ts:21`, `:56` | `telegram.test.ts:73` (601 s dropped, 600 s kept) | holds (a missing `date` is dropped by the same line; no test of its own) |
| A dropped message still advances `offset`, so a stranger cannot hold the queue | `poll.ts:54` (before the check) | `telegram.test.ts:73` ("the poll after them" waits for `last.update_id + 1`) | holds |
| A dropped message leaves no trace: no line, no notice, no count | `poll.ts:56` | `telegram.test.ts:73` | by design (`telegram.md:24`: "dropped: it never reaches the coordinator and gets no answer"); no rule asks for more |

## Phone commands

Every phone command, from `grep -rn "phone: {" packages/*/src`: `/board`, `/task`, `/plan` (orchestration/board-commands.ts:29), `/silent` (orchestration/silent.ts:76), `/jobs`, `/steer`, `/stopall` (core/job-commands.ts:27-47), `/restart` (session/restart.ts:79), `/findings`, `/health`, `/machines`, `/projects`, `/resources`, `/retro`, `/usage`. None merges, continues or starts a job; `merge` has no `phone` and `/merge AR1` is "unknown command" (`packages/core/test/commands.test.ts:140`, line 145-147). Stopping (`/stopall`), steering (`/steer`), restarting (`/restart`) and silencing (`/silent`) are reachable; a merge or a spend is reachable only through the coordinator, that is, through a `message-received`, which the same chat check guards.

| Rule | Enforced at | Test | Verdict |
| --- | --- | --- | --- |
| A command is one text message whose first word is `/name` (1 to 32 word characters), optionally `@<bot>`, then a space, a line break or the end; the registry matches the name as written, so `/Jobs`, `/merge`, `/job` are unknown and get the registry's line; nothing of a command reaches the coordinator | `poll.ts:24`, `:80-84`; `commands.ts:74-80` | `commands.test.ts:26`, `:80`; `core/test/commands.test.ts:140` | holds |
| A caption or an album's text is never a command (`text` is read from one lone message; a media message has `caption`, not `text`) | `poll.ts:78`, `:80` (`messages.length === 1 && typeof text === "string"`) | `commands.test.ts:80` (slash texts that are no command); no test of a caption `/stopall` | holds without a test |
| `/name@<other bot>` is dropped unanswered once `getMe` gave this bot's username; until it answers, every `@<bot>` counts as this bot | `poll.ts:67-68`, `:83` | `commands.test.ts:43`, `:65` | holds in a private chat (one bot in it); in a group with another bot, a member's `/stopall@other_bot` runs while `getMe` fails (probe), a documented limit (`telegram.md:65`) that matters only under F1's condition |
| The commands that stop, steer, restart or silence check nothing about who asks: the registry's `route` relies on the channel | `commands.ts:74-85`; `job-commands.ts:27-33`, `:47`; `restart.ts:44-49` (refused while a job runs, not by sender); `silent.ts:76` | `core/test/commands.test.ts:130-138` (`from` is passed through as given) | holds through the rows above; the one check is the channel's chat check, F1 names it |
| A message the owner forwarded (`forward_origin`), or one quoting another's text, is handled as the owner's own text, a command included: `/stopall` forwarded runs, an instruction forwarded reaches the coordinator with no mark that the owner did not write it | nothing: `forward_origin`, `quote`, `reply_to_message` are not read (`poll.ts:78-84`) | none | **gap**, low: F2 (probe: a forwarded `/stopall` ran and was answered). The steering of the coordinator by such text is AR0322's area; the command is this one's |
| A command's reply goes by the same bot, to its chat, in the message's topic | `poll.ts:79`, `:84` | `commands.test.ts:26`, `:65` | holds |

## Replies and files go to the owner's chat only

| Rule | Enforced at | Test | Verdict |
| --- | --- | --- | --- |
| Every `sendMessage` names a configured bot's chat: `chat_id: bot.chat`; a `place` goes only as `message_thread_id`, and only when it is a topic's number | `outbox.ts:60`; `bot-api.ts:20` (`topic`); `telegram.ts:57`, `:61` | `telegram.test.ts:104` (a place to its topic), `media.test.ts:128` ("a place not a topic goes to the chat") | holds |
| A slice in the outbox cannot name another chat: it has `bot`, `text`, `place` and nothing else; `bot` is matched by name among the configured bots, else the main one; a `place` that is no topic sets the slice aside | `outbox.ts:91`, `:139` | `telegram.test.ts:374` "a file in the outbox that is no slice, broken or edited by hand, is set aside …; one of a bot gone goes by the unnamed one" | holds |
| A reply goes by the bot each message it answers came through, to that bot's chat; a notice and a reply to no message by the unnamed bot, else the first | `telegram.ts:49-53`, `:57`, `:61` | `telegram.test.ts:215` "every bot polls its own chat; a reply goes by each bot …" | holds; each bot's chat is the owner's by the rows above, so a named bot pointed at a group is F1's case |
| `channel.send` (`arthur send`) sends files by the unnamed bot, else the first, to its chat or the topic its `place` names | `media-out.ts:45-50` | `media.test.ts:107`, `:128` | holds |
| A reply or an error never carries the token | `bot-api.ts:25` | `telegram.test.ts:186`, `media.test.ts:179` | AR0319's area, named here only because a reply is what the chat sees |

## The load

| Rule | Enforced at | Test | Verdict |
| --- | --- | --- | --- |
| `chatIdEnv` must hold a whole safe integer, `botTokenEnv` a token of @BotFather's shape; a refusal names the option and the variable, never the value | `telegram.ts:86-89` | `telegram.test.ts:38` | holds (but the integer may be negative: F1) |
| Any option or key the plugin does not know is refused at load, naming its path | `telegram-options.ts:28-50` | `telegram.test.ts:18` | holds |
| The Discord and Slack plans name `userIdEnv`, "the only user it answers", beside the server or workspace; the Telegram options name a chat and no user | `arthur.config.example.ts:373` against `:446`, `:461` | none (plans) | F1's fix brings Telegram in line |

## AR0311's notes

- F7 (only the chat id is compared, and a group id is accepted at load): confirmed. `poll.ts:56` compares `message.chat.id` alone; `telegram.ts:89` accepts a negative id and its message calls it a group's; `telegram.test.ts:50` asserts that acceptance; `telegram.md:13` promises a private chat while `:16` repeats "negative for a group". In the probe, with a configured supergroup id, another member's text reached the coordinator, an anonymous admin's (`sender_chat`) `/stopall` ran and was answered, and a member's `/stopall@other_bot` ran while `getMe` failed. With a positive chat id, a message of another chat was dropped unanswered and its photo never fetched. Entry F1 in `findings.md`.
