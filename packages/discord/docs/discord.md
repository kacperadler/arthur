# The discord plugin

Roadmap entries 89 and 90: the owner talks to the coordinator from a private Discord server. Each bot keeps one outbound connection to Discord's gateway, so nothing listens on the internet; the owner's text, photos, videos, voice messages and files in the server's text channels reach the coordinator, `/name text` typed or picked from Discord's `/` menu runs a phone command, and the coordinator's replies and Arthur's notices come back through an outbox that survives Discord being away and a restart; `arthur send` sends files. It has no command of its own.

```ts
plugins: [orchestration({}), discord({ bots: [{ tokenEnv: "ARTHUR_DISCORD_BOT_TOKEN", guildIdEnv: "ARTHUR_DISCORD_GUILD_ID", userIdEnv: "ARTHUR_DISCORD_USER_ID", channelIdEnv: "ARTHUR_DISCORD_CHANNEL_ID" }] })],
```

## Options

In `discord({ ... })` in `arthur.config.ts`, checked at load; any other option or key is refused, naming its path:

- `bots`: at least one bot, each `{ name?, tokenEnv, guildIdEnv, userIdEnv, channelIdEnv }`, every one a variable's name: the bot's token, the id of the one server it answers, the owner's user id (the one user it answers) and the id of the main channel, the coordinator's. At most one bot has no name; a name is lowercase letters, digits and single dashes, from a letter, and no two bots share one. A named bot's variables are `ARTHUR_DISCORD_<NAME>_...`, as for every named instance (`arthur config --help`).
- `apiUrl`: the REST API's address, default `https://discord.com/api/v10`; a test points it at its fake. `http` is refused unless the host is loopback (`localhost`, 127.0.0.0/8, `::1`).

At setup, a token that is not three parts of letters, digits, `_` and `-` joined by dots refuses the load with `bots[<i>].tokenEnv: <variable> does not hold a bot token as Discord's developer portal gives it: ...`, and an id that is not a positive whole number below 2^64 with `bots[<i>].<key>: <variable> does not hold a server id` (a user id, a channel id) `: a positive whole number below 2^64, as Copy ID gives it`; neither prints the value. A variable left unset is refused the same way.

Only `arthur run` starts the plugin, so only it connects and sends; a command such as `arthur stop` loads it and neither connects nor writes the outbox. What reaches it before its start, the replay of the event log among it, is queued at the start, in order.

## The connection

Each bot asks `GET /gateway/bot` with `Authorization: Bot <token>` and Discord's `User-Agent: DiscordBot (...)`, then opens Node's own `WebSocket` to the address it answers, with `?v=10&encoding=json`. The token goes only in that header and in the Identify payload, never in a URL, and only over `wss:`: any other gateway address (`ws:` is let through on loopback, for the tests) ends the connection with `discord bot <name>: the gateway address "<url>" is not wss:, and the token goes only over an encrypted connection`.

- Hello gives the heartbeat interval: the first heartbeat goes after a random part of it, then one every interval, each with the last sequence number; one Discord asks for (op 1) goes at once. Identify asks for the intents GUILDS, GUILD_MESSAGES and MESSAGE_CONTENT (33281) and no other.
- A heartbeat Discord did not acknowledge (op 11) before the next one closes the connection with 4000, which keeps the session, and the bot resumes (op 6) through READY's `resume_gateway_url`, with its `session_id` and the last sequence. So do op 7 (reconnect), op 9 with `d: true`, and any close Discord makes but those below.
- op 9 with `d: false`, and the closes 4007 and 4009, start a new session: op 9 after 1 to 5 s. A connection that never got to READY or RESUMED waits before the next try, 1 s doubling to 60 s; a failed `GET /gateway/bot` too, or the seconds its 429 gives, with one line on stderr said once: `discord bot <name>: GET /gateway/bot: <status>: <message>; the gateway connects again in <seconds> s`.
- A new session never identifies while `GET /gateway/bot` gives fewer than 50 session starts left: Discord resets the token after 1000 in a day. The bot says `discord bot <name>: only <n> of Discord's daily session starts are left, ...; the bot connects again once they reset, in <seconds> s` once and waits for `reset_after`, so a crash loop of restarts cannot burn the token.
- The closes Discord says not to retry end the bot's connection until the next start, said once on stderr and in a `notice` (which Telegram or the terminal shows): 4004, `Discord refused the token in <tokenEnv> (4004 Authentication failed): reset it on the Bot page of the application at discord.com/developers/applications, put the new one in <tokenEnv> and restart Arthur`; 4014, `Discord refused the MESSAGE_CONTENT intent (4014 Disallowed intents): switch on Message Content Intent on the Bot page ...`; 4010 to 4013, each named. Neither prints the token.
- A stop closes with 1000, so the bot shows offline. A close Discord does not answer within 5 s, as over a dead network path, counts as lost (1006): a stop ends, and a heartbeat's close resumes.

## Receiving

GUILD_CREATE gives the server's text channels (type 0), and CHANNEL_CREATE, CHANNEL_UPDATE and CHANNEL_DELETE keep that set. A `MESSAGE_CREATE` counts only when it is of the bot's server (`guild_id`), by the owner (`author.id`), has no `webhook_id` and is a plain message or a reply (type 0 or 19); anything else is dropped unanswered: another user, the bot itself, another server, a webhook, a system message. A direct message never arrives, since no DIRECT_MESSAGES intent is asked. An edit (`MESSAGE_UPDATE`) is no new message, so it is never heard.

- In the main channel the message becomes `message-received` `{ channel: "discord", parts }`; in another text channel of the server it adds `place`, that channel's id; a message to a named bot adds `instance`, the bot's name. Until the project agents route by place (entries 85 and 86), a project channel's message reaches the coordinator and the reply goes to the main channel.
- The parts: the message's files first, in order, then its text, trimmed, as a `text` part. Each attachment is downloaded at once, since Discord's CDN links expire, from its signed `url`, which asks no token, so none goes with it, and saved whole as `.arthur/discord/media/<attachment id>-<file name>` (the name's last segment, without control characters or leading dots, so it stays in the folder; `<attachment id>` alone for a file without a name). A voice message (the message flag IS_VOICE_MESSAGE, 8192) is `voice`, with Discord's `duration_secs` as `seconds`; any other file goes by its `content_type`: `image/*` a `photo`, `video/*` a `video`, `audio/*` an `audio`, anything else, or none, a `file` (`application/octet-stream` when Discord gives no type). The plugin reads nothing of it.
- A file Discord does not hand over is a `text` part in its place saying why, `[<kind> <file name> not saved: <why>]`: `Discord's CDN answered <status>`, `Discord gave no url`, or the download's error. A stop during a download drops the message, which is then not heard, so the next start reads it again.
- A sticker, and a message with neither text nor a file (only a link's preview, say), gets `only text, photos, videos, voice messages, audio and files reach the coordinator: a sticker is not read` back in the channel it came in; a sticker's text, if any, still reaches the coordinator.
- A message the owner forwarded (`message_reference.type` 1, the original in `message_snapshots`) reaches the coordinator as the snapshot's files, then `[forwarded from <author>]` and the texts of the message and its snapshot, the author the event names (Discord's snapshot names none today, so it reads `a hidden sender`), without control characters, line or paragraph separators, format characters or `]`. One without text is the mark alone, after its files. It is never a phone command.
- Messages are heard one after another, in the order they came: one that waits for its downloads holds those after it, and a stop waits for the message in hand.

Discord does not replay what was written while the bot was away. So each GUILD_CREATE, which a new session brings, reads each text channel's messages since the last one heard there, at most 10 minutes back (`GET /channels/{id}/messages?after=...`, which needs the Read Message History permission), oldest first, before what comes after it. The last message heard in each channel is kept in `.arthur/discord/seen.json`, by bot, so none is heard twice across a restart; a broken file reads as nothing heard. A failed read is one line on stderr naming the channel. A message that cannot be kept as heard (`seen.json` not written) is dropped with one line on stderr, `discord bot <name>: message <id> is not read: <error>`, and the messages after it are still heard.

## Sending

A reply goes by the bot each message it answers came through (its `answers`, read in the event log; each bot once); a reply that answers no message of a bot, and every notice, goes by the unnamed bot, else the first in the list:

- `coordinator-replied` whose `channels` hold `discord`, and a reply with no `channels`; a reply only for another channel is not sent.
- `notice`, unless `call("coordinator.silent", notice)` answers `true` (`arthur silent --help`).
- A `place` that is one of the server's text channels is where it goes; without one, or with any other, it goes to the main channel. A slice with a place waits until the gateway named the channels.
- Each send is `POST /channels/{id}/messages` with `allowed_mentions: { parse: [] }`, so no text pings anyone, and in quiet hours (`core.quietHours`) `flags: 4096` (SUPPRESS_NOTIFICATIONS): no push, only the badge.
- A text longer than one message goes in slices of at most 2000 UTF-16 units, each cut at its last line break; a line longer than a slice is cut inside it, never through a character of two units. A blank text sends nothing.

### The outbox

As telegram's: every slice is first a file of `.arthur/discord/outbox/`, `{ bot, text, place? }`, named so that a plain sort is the order it was queued in, across processes, sent oldest first by one process at a time holding `.arthur/discord/outbox.lock`.

- A send that fails (no answer in 30 s, Discord unreachable, a 5xx) is tried once more after 2 s; a `429` holds every send for its `retry_after`. A slice that fails the retry too stays, with every slice after it, and goes first next time; one line on stderr, said once until a slice goes: `discord bot <name>: POST /channels/<id>/messages: <status>: <message>; the slice waits in <outbox> and goes first next time`.
- A refused slice (any other 4xx: `404 Unknown Channel` for a channel deleted while it waited, a missing permission) moves to `outbox/refused/`, one line on stderr, and the next slices go; the first refusal since a slice last went is told in a `notice` with the slice.
- A file of the outbox that is not such a slice is set aside the same way, with a line and no notice. A send under way ends even at a stop; a wait is cut short.

### Sending files

`channel.send`, which `arthur send` asks (`arthur send --help`), sends files at once by the unnamed bot, else the first, not through the outbox, so it needs no gateway: as one message, one multipart request (`POST /channels/{id}/messages` with `payload_json`, which holds the caption as `content`, `allowed_mentions: { parse: [] }`, `flags: 4096` in quiet hours and each file's `{ id, filename }` in `attachments`, and the files as `files[0]` to `files[n]`). A `place` goes where it is a text channel of the bot's server, asked of Discord (`GET /channels/{id}`); a place Discord says is no such channel (any 4xx, a 429 aside), one of another server, the main channel's id, and one that is no id go to the main channel. A lookup or an upload that fails ends the send with Discord's line, `discord bot <name>: <call>: <status>: <message>`, never the token. It answers `sent <n> files in 1 message`.

Every file is checked before anything goes, and each problem is one line of the refusal: more than 10 files (`<n> files; Discord takes at most 10 in one message`); a caption over 2000 characters; a missing file or a folder (`<path>: no such file`); an empty one (`<path>: empty; Discord takes no empty file`); one over 20 MiB (`<path>: <size> bytes; Discord takes at most 20971520 (20 MiB) in one file`); the files and the caption together over 25 MiB (`<bytes> bytes in all; Discord takes at most 26214400 (25 MiB) in one message`). Discord's "Uploading Files" reference sets both limits.

## Phone commands

A message that starts with `/name` (1 to 32 letters, digits and underscores, then a space, a line break or its end), written by the owner, not forwarded and without a file, is a phone command, not a message to the coordinator: the plugin hands `/name` and the rest of the text to the host's command registry (`arthur help --help`, "Phone commands"), with `channel: "discord"`, its `place` for a message in a project channel and its `instance`, the bot's name, for a message to a named bot. The reply goes back by the same bot to the same channel, through the outbox like any reply, so one longer than a message goes in slices of at most 2000, in order.

- A name no phone command has gets the registry's line, `unknown command /<name>; phone commands: /a, /b`; the case counts, so `/Jobs` is unknown too.
- A text where the slash starts no such name (`/tmp/x is full`, `/ hi`, a name over 32 characters, a space before the slash) reaches the coordinator as any text, and so does `/name` in a message with a file.
- A forwarded `/name` is never run: it reaches the coordinator marked `[forwarded from ...]`. An edit to `/name` is no new message, so it runs nothing.
- A command written while Arthur was away, at most 10 minutes back, runs once at the start; it counts as heard before it runs, so a restart never runs it twice.
- A command is handled in its turn among the messages: those after it wait for its reply.

### The `/` menu

Typing `/` in the server lists the phone commands, each with its `about`, as Telegram's command menu does. At each READY (the start, and each new gateway session) each bot sets them as its server's guild commands (`PUT /applications/{application id}/guilds/{server}/commands`), each with one optional string option, `text`, for what follows the name. An `about` over Discord's 100 characters is cut to 99 with `…` after it. The set is sent only when it differs from what `.arthur/discord/commands.json` records for that application and server, so an unchanged start sends nothing; a broken record counts as empty. A refusal is one line on stderr, `discord bot <name>: PUT ...: <status>: <message>; the / commands are set again at the next start`, and leaves the record as it was.

A command picked there comes over the same gateway connection (an `INTERACTION_CREATE`), and every answer to it is an outgoing call, so nothing listens:

- From the owner, in the bot's server and one of its text channels, it is answered at once with a deferred answer (Discord shows the bot thinking), then runs exactly as `/name text` typed in that channel, with the same `channel`, `place` and `instance`. The reply fills the deferred answer, in slices of at most 2000 as follow-ups (`POST /webhooks/{application id}/{token}`); a blank reply says `/name gave no reply`.
- From anyone else, another server, a DM, a thread or another channel that is not one of the server's text channels, or before the bot knows its server's channels, it gets a refusal only the picker sees, `only the owner's commands in the server's text channels run`, and runs nothing.
- A deferred answer Discord refuses (it came after Discord's 3 s, or the interaction was replayed after a resume) runs nothing, said on stderr, so a command never runs twice; Discord shows that the application did not respond.
- A follow-up Discord refuses (its 15 minutes passed, or Discord is away) sends what was not sent through the outbox to the channel the command was picked in.
- A picked command does not wait behind the messages; a stop waits for it and its reply.
- The interaction's token never shows in a line on stderr: the call names it `{token}`.

## Doctor

`arthur doctor` shows five lines per bot, each `discord bot <name>: <requirement>`, none critical, so a token Discord reset never keeps the coordinator from starting: `token` and `Message Content Intent` (`GET /applications/@me`: its `flags` hold GATEWAY_MESSAGE_CONTENT or GATEWAY_MESSAGE_CONTENT_LIMITED), `server 2FA` (`mfa_level` 1) and `server members` (exactly 2, you and the bot, from `GET /guilds/{id}?with_counts=true`), and `commands` (`GET /applications/{id}/guilds/{id}/commands` lists each phone command with the description the plugin sets, and no other), each with its fix. A 401, 403 or 404 is `missing: ...`; a Discord that does not answer within 5 s, or answers anything else, is `ok (Discord not reached: ...)`. `commands` is `missing` when the record says the menu is set but Discord lost it (the bot was removed and invited again): its fix is to invite the bot again with `applications.commands`, remove `.arthur/discord/commands.json` and restart Arthur.

## Setting it up

About 15 minutes, once:

1. **Server.** In Discord, use "+" and "Create My Own" to make a server, then its main text channel (for example `#arthur`). Make one more text channel per project by hand when you want it.
2. **2FA.** Turn on two-factor login (an authenticator app) on your own account, then "Require 2FA for moderator actions" in the server's Safety Setup.
3. **Bot.** At discord.com/developers/applications make a New Application. On its Bot page use Reset Token and put the token in `ARTHUR_DISCORD_BOT_TOKEN` in the env file; switch on "Message Content Intent" (a bot in fewer than 100 servers needs only this switch) and switch off "Public Bot".
4. **Invite.** Open `https://discord.com/oauth2/authorize?client_id=<Application ID>&scope=bot+applications.commands&permissions=101376` and pick your server. `applications.commands` lets the bot set its `/` menu; Discord includes it with `bot` today, so a bot invited earlier with `scope=bot` needs nothing new. 101376 is View Channels (1024), Send Messages (2048), Attach Files (32768) and Read Message History (65536), and no other.
5. **The ids.** In User Settings, Advanced, turn on Developer Mode, then right-click (long-press on the phone) each and use Copy ID: the server into `ARTHUR_DISCORD_GUILD_ID`, your own name into `ARTHUR_DISCORD_USER_ID`, the main channel into `ARTHUR_DISCORD_CHANNEL_ID`.
6. **Config.** Add `discord({ bots: [...] })` as above to `arthur.config.ts` and run `arthur config check`: the four variables say `set`.
7. **Phone.** Set the server's notifications to "All Messages" on your phone.
8. **Check.** Restart the service, run `arthur doctor` (each Discord line `ok`), then write "hi" in the main channel, and `/board`, which Arthur answers at once. Type `/` in the channel: the phone commands are listed, and picking `/board` answers the same way.

Never paste a secret in a channel: Discord keeps every message on its servers.

Telegram can stay on beside it: a reply goes to the channel its message came from, and every notice goes to both. The day Discord is the only channel, set `telegram({ enabled: false, ... })`; a slice still waiting in `.arthur/telegram/outbox/` stays there unsent.
