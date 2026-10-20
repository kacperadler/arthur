# The telegram plugin

Roadmap entries 47 to 50: the owner talks to the coordinator from Telegram. Each bot polls the one chat it answers; what the owner sends, text and media, reaches the coordinator, and the coordinator's replies and Arthur's notices come back through an outbox that survives Telegram being away and a restart; `arthur send` sends files. A `/name` text runs a phone command without the model, and each bot's command menu lists them. It has no command of its own.

```ts
plugins: [orchestration({}), telegram({ bots: [{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" }] })],
```

## Options

In `telegram({ ... })` in `arthur.config.ts`, checked at load; any other option or key is refused, naming its path:

- `bots`: at least one bot, each `{ name?, botTokenEnv, chatIdEnv }`. `botTokenEnv` names the variable holding the bot's token from @BotFather, `chatIdEnv` the one holding the id of the only chat the bot answers (the owner's private chat with it). At most one bot has no name; a name is lowercase letters, digits and single dashes, from a letter, and no two bots share one. A named bot's variables are `ARTHUR_TELEGRAM_<NAME>_...`, as for every named instance (`arthur config --help`).
- `apiUrl`: the Bot API's address, default `https://api.telegram.org`; a test points it at its fake. The token is part of each call's URL, so it goes only there.

At setup, a token that is not `<digits>:<letters, digits, _ and ->` refuses the load with `bots[<i>].botTokenEnv: <variable> does not hold a bot token as @BotFather gives it: ...`, and a chat id that is not a whole number with `bots[<i>].chatIdEnv: <variable> does not hold a chat id: a whole number, negative for a group`; neither prints the value.

Only `arthur run` starts the plugin, so only it polls and sends texts; a command such as `arthur stop` loads it and neither sends nor writes the outbox, and `arthur send` sends its files at once, by its own process (below). What reaches it before its start, the replay of the event log among it, is queued at the start, in order.

## Receiving

Each bot long-polls `getUpdates` (30 s, only `message` updates), each update confirmed by the next call's `offset`:

- A message of another chat than the bot's is dropped: it never reaches the coordinator and gets no answer.
- A message older than 10 minutes (its `date` against Arthur's clock; 10 minutes exactly is kept) is dropped, so a backlog after Arthur was down does not replay.
- What the message holds becomes one `message-received` `{ channel: "telegram", parts }`, which the coordinator's inbox turns into one entry marked `[via telegram]` (`arthur send --help`, "Channels", and `arthur coordinator --help`). A message in a topic (`is_topic_message`, in a private chat with topics on) adds `place`, its `message_thread_id` as text; a message to a named bot adds `instance`, the bot's name.
- The parts: the message's file first, then its text or caption as a `text` part. A photo (its largest size, `image/jpeg`), a video or a round video note (`video`), a voice note (`voice`), an audio file (`audio`) and any other document (`file`), each with Telegram's `mime_type` (else `video/mp4`, `audio/ogg`, `audio/mpeg`, `application/octet-stream`) and `seconds` for its `duration`. The file is saved, whole, as `.arthur/telegram/media/<file_unique_id><extension of Telegram's file_path>`, or `<file_unique_id>-<the sender's file name>` for a file sent with a name (its last segment, without control characters or leading dots, so it stays in the folder). The plugin reads nothing of it.
- An album, several messages with one `media_group_id`, is one `message-received`: every file in the order the messages came, then the caption. While one is open, polling waits 1 s instead of 30, and the album goes once a poll brings no more of it; the messages after it wait for it, so they keep their order.
- A file Telegram does not hand over is a `text` part saying why: `[<kind> not saved: <size> bytes is over the 20971520 (20 MB) a bot may download]`, not asked for, or `[<kind> not saved: <the getFile or download error>]`, never the token.
- Any other kind of message (a sticker, a location, a poll, ...) gets `only text, photos, videos, voice notes, audio and files reach the coordinator` back, in its topic, and nothing reaches the coordinator.

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

### Sending files

`channel.send`, which `arthur send` asks (`arthur send --help`), sends files at once by the unnamed bot, else the first, to its chat or the topic its `place` names, without a notification in quiet hours, not through the outbox. `.jpg`, `.jpeg`, `.png` and `.webp` go as photos, `.mp4` and `.mov` as videos, any other file as a document, and so does a photo over 10 MB. Photos and videos go as one album (`sendMediaGroup`; one alone as `sendPhoto` or `sendVideo`), then the documents as one more (`sendDocument` for one), since Telegram puts a document in an album only with documents; the caption goes on the first message. It answers `sent <n> files in <m> messages`.

Every file is checked before anything goes, and each problem is one line of the refusal: more than 10 files (`<n> files; Telegram takes at most 10 in one album`); a caption over 1024 characters; a missing file (`<path>: no such file`); an empty one; one over 50 MB (`<path>: <size> bytes; Telegram takes at most 52428800 (50 MB) from a bot`); a photo whose width plus height is over 10000 px or whose sides differ by more than 20 to 1, read from the PNG, JPEG or WebP header (`<path>: <w>x<h> px; ... slice it into viewport-high images (for example 1600 px tall) and send them as one album`): Telegram would reject it, and as a document it has no preview. A message Telegram refuses ends the send, naming it and what went before: `telegram bot <name>: <method>: <code>: <description>; nothing went` (or `; <k> of <m> messages went before it`), never the token; an upload is given 5 minutes.

## Phone commands

A text message that starts with `/name` (1 to 32 letters, digits and underscores, then a space, a line break or its end) is a phone command, not a message to the coordinator: the plugin hands `/name` and the rest of the text to the host's command registry (`arthur help --help`, "Phone commands"), with `channel: "telegram"` and, for a message in a topic, its `place`, and sends the reply back by the same bot to the same chat and topic, through the outbox like any reply, so a reply longer than one message goes in slices, in order. Nothing of it reaches the coordinator.

- A name no phone command has gets the registry's line, `unknown command /<name>; phone commands: /a, /b`; the case counts, so `/Jobs` is unknown too. A command that throws answers `/<name> failed: <first line of the error>`.
- `/name@<bot>` is `/name` when `<bot>` is this bot's username, in any case, from `getMe`, asked when a command first names a bot and kept once it answers; a command to another bot is dropped, unanswered. While `getMe` has not answered, every `@<bot>` counts as this bot.
- A text where the slash starts no such name (`/tmp/x is full`, `/ hi`, a name over 32 characters) and a caption reach the coordinator as any text.
- A command is handled in its turn among the messages: the messages after it wait for its reply, so a slow command holds them.

At every start of `arthur run`, each bot's menu is set to the phone commands the enabled plugins registered, sorted by name, each with its `about` line (`setMyCommands`; `deleteMyCommands` when there is none), but only when they differ from what `.arthur/telegram/menu.json` records as set for that bot: a start with the same commands calls nothing. The record is keyed by the bot's id, the part of its token before the colon, never the token. A refused or failed call is one line on stderr, `telegram bot <name>: setMyCommands: <code>: <description>; the command menu is set again at the next start`, and the record stays as it was, so the next start tries again; a record that does not parse records nothing. Delete the file to set every menu again.

The session's start notice (`coordinator up on <host>`, or `no LLM access on <host>: ...`, after the lines `arthur doctor` found missing) is a `notice`, sent as it comes, as one text, unless the silent mode holds it, as it holds every notice but a blocked job's.

## Setting it up

1. In Telegram, talk to @BotFather: `/newbot`, a name, then the token it gives goes to `ARTHUR_TELEGRAM_BOT_TOKEN` in `.env`.
2. Write once to your bot, then read your chat id from `curl -s https://api.telegram.org/bot<token>/getUpdates` (`message.chat.id`) and put it in `ARTHUR_TELEGRAM_CHAT_ID`; stop anything else polling the bot first.
3. Add `telegram({ bots: [...] })` as above and run `arthur config check`: both variables say `set`.
