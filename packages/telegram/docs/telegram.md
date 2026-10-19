# The telegram plugin

Roadmap entries 47 and 48: the owner talks to the coordinator from Telegram. Each bot polls the one chat it answers; the owner's text reaches the coordinator, and the coordinator's replies and Arthur's notices come back through an outbox that survives Telegram being away and a restart. Photos, files and voice notes (49) and phone commands such as `/silent` with the menu (50) are later entries: until 50, a `/name` text reaches the coordinator as any text. It has no command of its own.

```ts
plugins: [orchestration({}), telegram({ bots: [{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" }] })],
```

## Options

In `telegram({ ... })` in `arthur.config.ts`, checked at load; any other option or key is refused, naming its path:

- `bots`: at least one bot, each `{ name?, botTokenEnv, chatIdEnv }`. `botTokenEnv` names the variable holding the bot's token from @BotFather, `chatIdEnv` the one holding the id of the only chat the bot answers (the owner's private chat with it). At most one bot has no name; a name is lowercase letters, digits and single dashes, from a letter, and no two bots share one. A named bot's variables are `ARTHUR_TELEGRAM_<NAME>_...`, as for every named instance (`arthur config --help`).
- `apiUrl`: the Bot API's address, default `https://api.telegram.org`; a test points it at its fake. The token is part of each call's URL, so it goes only there.

At setup, a token that is not `<digits>:<letters, digits, _ and ->` refuses the load with `bots[<i>].botTokenEnv: <variable> does not hold a bot token as @BotFather gives it: ...`, and a chat id that is not a whole number with `bots[<i>].chatIdEnv: <variable> does not hold a chat id: a whole number, negative for a group`; neither prints the value.

Only `arthur run` starts the plugin, so only it polls and sends; a command such as `arthur stop` loads it and neither sends nor writes the outbox. What reaches it before its start, the replay of the event log among it, is queued at the start, in order.

## Receiving

Each bot long-polls `getUpdates` (30 s, only `message` updates), each update confirmed by the next call's `offset`:

- A message of another chat than the bot's is dropped: it never reaches the coordinator and gets no answer.
- A message older than 10 minutes (its `date` against Arthur's clock; 10 minutes exactly is kept) is dropped, so a backlog after Arthur was down does not replay.
- A text becomes `message-received` `{ channel: "telegram", text }`, which the coordinator's inbox marks `[via telegram]` (`arthur coordinator --help`). A message in a topic (`is_topic_message`, in a private chat with topics on) adds `place`, its `message_thread_id` as text; a message to a named bot adds `instance`, the bot's name.
- Any other kind of message (a photo, a sticker, a location, ...) gets `only text, photos and files reach the coordinator` back, in its topic, and nothing reaches the coordinator.

A failed call is said once until a call answers again, and polling goes on after 2 s, or after the seconds a `429 Too Many Requests` gives as `retry_after` when that is longer. A second process polling the same bot (`409 Conflict`, another Arthur or a forgotten script) emits one `notice` `{ text: "telegram bot <name or (unnamed)>: getUpdates: 409: <Telegram's description>; until it ends, nothing written to this bot reaches the coordinator; polling retries every 2 s" }`; any other failure is one line on stderr, `telegram bot <name>: getUpdates: <code>: <description>; polling retries in <seconds> s` (or `cannot reach the Bot API (<code>)` in place of the code and description), never the token. A poll that answers sends what waits in the outbox, so a reply queued while Telegram was away goes once it is back, with nothing new to send.

## Sending

A reply goes by the bot each message it answers came through (its `answers`, the numbers of their `message-received` events, read in the event log; each bot once), to that bot's chat; a reply that answers no message of a bot, and every notice, goes by the unnamed bot, else the first in the list:

- `coordinator-replied` whose `channels` hold `telegram`, and a reply with no `channels` (from a turn of only `[Arthur]` messages), as a notice is; a reply only for another channel is not sent.
- `notice`, unless `call("coordinator.silent", notice)` answers `true`: the silent mode holds every notice but the one of a job blocked on the owner (`arthur silent --help`).
- A `place` that is a topic's number goes as `message_thread_id`; without one, or with any other, the message goes to the chat itself.
- A text longer than one message goes in slices of at most 4096 UTF-16 units, each cut at its last line break; a line longer than a slice is cut inside it, never through a character of two units. A blank text sends nothing.
- In quiet hours (`core.quietHours`, across midnight when `from` is the later time) every send goes with `disable_notification`, as the clock says when it goes.

### The outbox

Every slice is first a file of `.arthur/telegram/outbox/`, `{ bot, text, place? }` (`bot` the name, `null` for the unnamed bot), named `<milliseconds>-<pid>-<count>.json` so that a plain sort is the order the slices were queued in, across processes. One process at a time sends them, oldest first, holding `.arthur/telegram/outbox.lock` (a holder that died is taken over); another process that finds the lock held leaves its slices to the holder, which lists the outbox again before it lets go. A slice leaves the outbox once Telegram took it.

- A send that fails (no answer in 30 s, the Bot API unreachable, a 5xx) is tried once more after 2 s. A `429 Too Many Requests` holds every send for the seconds its `retry_after` gives (2 s when it gives none), and the retry goes after them.
- A slice that fails the retry too stays, with every slice after it, and goes first next time: at the next send, the next poll that answers, or the next start. One line on stderr, said once until a slice goes: `telegram bot <name>: sendMessage: <code>: <description>; the slice waits in <outbox> and goes first next time`.
- A refused slice (any other 4xx: a chat not found, a bot blocked, a topic deleted, a 401) is never tried again: it moves to `outbox/refused/`, one line on stderr (`...; the slice is set aside in <path>`), and the next slices go. The first refusal since a slice last went is told in a `notice`, `<the error>; this slice was set aside in <path>:` and the slice, cut to one message at a line break with `… cut; whole in <path>` after it; a refusal of that notice is not told again.
- A file of the outbox that is not such a slice (it does not parse, its text is blank, its `place` is no topic's number) is set aside the same way, with a line and no notice. A slice whose bot is no longer in `bots` goes by the unnamed bot, else the first.
- A stop cuts a 2 s or `retry_after` wait short; what did not go waits for the next start.

## Setting it up

1. In Telegram, talk to @BotFather: `/newbot`, a name, then the token it gives goes to `ARTHUR_TELEGRAM_BOT_TOKEN` in `.env`.
2. Write once to your bot, then read your chat id from `curl -s https://api.telegram.org/bot<token>/getUpdates` (`message.chat.id`) and put it in `ARTHUR_TELEGRAM_CHAT_ID`; stop anything else polling the bot first.
3. Add `telegram({ bots: [...] })` as above and run `arthur config check`: both variables say `set`.
