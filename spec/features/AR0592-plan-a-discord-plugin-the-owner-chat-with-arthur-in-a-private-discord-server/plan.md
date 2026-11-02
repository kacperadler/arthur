# AR0592 - Plan

- Job: 2026-10-30-plan-275b143b
- Planned at: 136f7d786c9fc6414137828e9b9f042f5b191336

## Approach

### In plain words (for the phone)

- **What you get.** A private Discord server with two members: you and Arthur's bot.
- **The main channel** (for example `#arthur`) is where you talk to the coordinator. It works like your Telegram chat today.
- **Every other text channel** you make (`#shop`, `#blog`) belongs to one project. They are there for when each project gets its own agent (roadmap 85 to 88). Until then, what you write in a project channel still reaches the coordinator, and it answers in the main channel.
- **Text** goes to the coordinator, and its answer comes back in Discord.
- **Photos, videos, voice messages and files** are saved on your server. Voice messages and videos are turned into text there by the listen and video plugins. Nothing goes to a cloud transcriber.
- **Commands.** Type `/jobs`, `/silent`, `/health` or `/usage` as a normal message. Arthur answers at once, without asking the AI. Discord shows no command menu the way Telegram does (question 3).
- **Silent mode and quiet hours** work as on Telegram. In quiet hours, messages arrive without a sound or a push.
- **Edits and forwards.** Editing a message does nothing. A forwarded message reaches the coordinator marked "forwarded" and never runs as a command.
- **Only you.** The bot ignores everyone else, every other server and private messages (DMs).
- **Nothing listens on the internet.** Arthur connects out to Discord, the way it already connects out to Telegram. Discord never connects in to Arthur.
- **What you do once (about 15 minutes):**
  1. Make the server.
  2. Turn on 2FA (two-factor login) for your Discord account and for the server.
  3. Make the bot on Discord's developer website and switch on "Message Content Intent".
  4. Add the bot to your server with the link from the setup guide.
  5. Put four values in the env file: the bot's token, the server id, your user id and the main channel id.
  6. Add one line to `arthur.config.ts` and restart Arthur.
  7. Run `arthur doctor`. It should say `ok` for each Discord line.
- **Telegram** can stay on beside Discord. My suggestion: keep both for a week, then turn Telegram off (question 5).
- **Two builds, about a day each:**
  - first: text in and out;
  - second: photos, files and voice, plus the commands.
- **Your answers before the build** are listed under Open questions.

### In detail

**This plan's scope.** The plan proposes two worker tickets: roadmap entries 89 and 90 of `spec/roadmap.md`, as written there. It adds the gaps listed below. A new package, `packages/discord/` (`@arthur/discord`), follows the telegram plugin's contract and layout (`packages/telegram/src/*`):

- `message-received` `{ channel: "discord", parts, place?, instance? }`;
- `coordinator-replied` with `channels`;
- `notice`, gated by `call("coordinator.silent", notice)`;
- `host.clock.isQuiet()` for quiet hours;
- `host.commands.route` for commands;
- `provide("channel.send")` for `arthur send`;
- `provide("doctor")` for `arthur doctor`.

**Left alone:**
- the core and its frozen plugin API (`docs/plugin-api.md`);
- the telegram plugin's code;
- orchestration (`coordinator-replied` carries no `place` today, `packages/orchestration/src/inbox.ts:187`, so replies go to the main channel);
- the projects plugin and AR0589's work.

The discord plugin reads no project setting, so it does not wait on AR0589.

**The setup the owner does once** (it goes into `packages/discord/docs/discord.md`, "Setting it up", and step 13 of `docs/setup.md`):

1. **Server.** In Discord, use "+" and "Create My Own" to make a server, then make the main text channel. Each project channel is made by hand: the bot is not given Manage Channels.
2. **2FA.** Turn on 2FA (an authenticator app) on your own account. Then turn on "Require 2FA for moderator actions" in the server's settings. Discord stores this as the server's `mfa_level`. [INFERENCE: exact menu names, not checked in a client]
3. **Bot.** At discord.com/developers/applications:
   - make a New Application;
   - on its Bot page, use Reset Token and put the token in `ARTHUR_DISCORD_BOT_TOKEN`;
   - switch on "Message Content Intent" (a privileged intent; Discord's application docs say a bot in fewer than 100 servers needs only this switch);
   - switch off "Public Bot".
4. **Invite.** Open `https://discord.com/oauth2/authorize?client_id=<Application ID>&scope=bot&permissions=35840` and pick your server. 35840 is View Channels (1024) + Send Messages (2048) + Attach Files (32768). [INFERENCE: these bit values are from memory; the permissions page I fetched did not show its table. The worker records them from Discord's table in `discord-shapes.json`.]
5. **The ids.** In User Settings → Advanced, turn on Developer Mode. Then long-press each item and use "Copy ID":
   - the server → `ARTHUR_DISCORD_GUILD_ID`;
   - your own name → `ARTHUR_DISCORD_USER_ID`;
   - the main channel → `ARTHUR_DISCORD_CHANNEL_ID`.
6. **Config.** Add `discord({ bots: [{ tokenEnv: "ARTHUR_DISCORD_BOT_TOKEN", guildIdEnv: "ARTHUR_DISCORD_GUILD_ID", userIdEnv: "ARTHUR_DISCORD_USER_ID", channelIdEnv: "ARTHUR_DISCORD_CHANNEL_ID" }] })` to `arthur.config.ts`. This is the shape already in `arthur.config.example.ts:465-476`.
7. **Phone notifications.** Set the server's notifications to "All Messages" on your phone. [INFERENCE: a new server may default to mentions only.]
8. **Check.** Run `arthur config check` (all four variables say `set`). Restart the service and run `arthur doctor`. Then write "hi" in the main channel.
9. **Never paste a secret in a channel.** Discord keeps every message on its servers.

**How a project channel is named after AR0589.** The accounts (`discord({ bots })`) stay once in `arthur.config.ts`. A project names its channel in `projects/<name>/project.config.ts` as `orchestration.project({ chat: { plugin: "discord", place: "<channel id>" } })`, which is AR0589's planned shape for `chat`. A named bot is chosen with `chat.instance`. Nothing reads `chat` until roadmap 85 and 86.

**How it works inside, ticket 1 (roadmap 89).**

*Connecting:*
- Only `arthur run` starts the gateway; other commands load the plugin without connecting, as telegram does.
- At start it calls REST `GET /gateway/bot` with `Authorization: Bot <token>` and a `User-Agent: DiscordBot (...)` header, which Discord requires. The token travels in that header and in the Identify payload, never in a URL.
- It then opens Node 24's built-in `WebSocket` to `<url>/?v=10&encoding=json`. I checked that `typeof WebSocket` is `function` on v24.21.0.
- The gateway URL from Discord, and later `resume_gateway_url`, must be `wss:`; `ws:` is allowed only on loopback, for tests. The token is never sent anywhere else.

*Keeping the connection alive:*
- **Hello** (op 10): the first heartbeat goes after `interval × random`, then one every interval.
- **Heartbeat** (op 1); a server-asked heartbeat is answered at once. **ACK** is op 11.
- **Identify** (op 2) asks for intents 33281: GUILDS (1<<0), GUILD_MESSAGES (1<<9) and MESSAGE_CONTENT (1<<15), the values in Discord's gateway docs.
- **READY** gives `session_id`, `resume_gateway_url` and the bot's user id.
- **GUILD_CREATE** and CHANNEL_CREATE/UPDATE/DELETE keep the set of the server's text channels (type 0).

*Losing and getting back the connection:*
- **A missed ACK** closes the socket with a code other than 1000 or 1001, then resumes.
- **op 7** (reconnect) resumes.
- **op 9** (invalid session): `d: true` resumes; `false` waits 1 to 5 s, then identifies.
- **Resume** (op 6) uses `resume_gateway_url`, `session_id` and the last `s`. Repeated failures back off, doubling up to 60 s.
- **No tight IDENTIFY loop.** Discord resets the token after 1000 IDENTIFYs in 24 h, so the plugin also reads `session_start_limit.remaining` from `GET /gateway/bot`. Below 50, it does not identify: it says so once and waits `reset_after`. A crash loop of restarts therefore cannot burn the token.

*Close codes:*
- **Fatal**, no retry, said once (stderr and a `notice`): 4004 (bad token, never printed); 4013 and 4014 (4014 names MESSAGE_CONTENT and the Bot page switch); 4010 to 4012.
- **Other codes** reconnect: 4007 and 4009 identify again, the rest resume.
- **Stop** closes with 1000, so the bot shows offline.

*Receiving:*
- A `MESSAGE_CREATE` counts only when:
  - it comes from the configured server;
  - its `author.id` is the owner's;
  - it has no `webhook_id`;
  - it is in a known text channel.
- Everything else is dropped. That covers other users, the bot itself, other servers and webhooks. DMs never arrive, since no DIRECT_MESSAGES intent is asked.
- In the main channel, the message has no `place`; in another text channel, `place` is that channel's id. A message to a named bot adds `instance`.
- **Threads and forum posts:** a message there is not read. One line goes to the main channel: "a message in a thread was not read: only the server's text channels reach Arthur". The reason: sending into threads would need one more permission.
- **Edits** (`MESSAGE_UPDATE`) are ignored.
- **A forward** (`message_reference.type` 1, with `message_snapshots`) reaches the coordinator as `[forwarded from <author or "a hidden sender">]` plus its text, the name cleaned as on Telegram (AR0365, AR0506). It is never a command.

*Sending:*
- **What goes out:**
  - `coordinator-replied` whose `channels` hold `discord`, or that names no `channels`;
  - a `notice` that silent mode does not hold.
- **Through an outbox.** Both go through `.arthur/discord/outbox/`, adapted from `packages/telegram/src/outbox.ts`: files named in queue order, a lock (`@arthur/core/lock`), one retry, and `retry_after` waited out on a 429.
- **The call:** `POST /channels/{id}/messages` with `{ content, allowed_mentions: { parse: [] }, flags }`:
  - `content` is cut at line breaks into slices of at most 2000 UTF-16 units;
  - `allowed_mentions` is empty, so no text pings anyone;
  - `flags` is 4096 (`SUPPRESS_NOTIFICATIONS`) in quiet hours.
- **Where it goes:** a `place` that is a known text channel of the server; otherwise the main channel.
- **A refused slice** (a 4xx other than 429, for example 404 Unknown Channel) is set aside in `outbox/refused/`, and the refusal is said once.

*Doctor:* the checks go through `host.provide("doctor")` in setup, because a plugin's own `doctor` field gets no env values (`packages/core/src/plugin.ts:48-50`).
- `GET /applications/@me`: the token works (critical, question 4).
- The same answer's `flags` hold GATEWAY_MESSAGE_CONTENT (1<<18) or GATEWAY_MESSAGE_CONTENT_LIMITED (1<<19) (critical).
- `GET /guilds/{id}?with_counts=true`: `mfa_level` is 1, and `approximate_member_count` is 2, the owner and the bot (neither critical). This needs no GUILD_MEMBERS intent: the docs list the count as a `with_counts` field.
- When Discord does not answer, the check says `ok (Discord not reached: ...)`, not a miss. A critical miss refuses `arthur run` (`packages/core/src/doctor.ts:74-80`), and a Discord outage must not keep Arthur down.

**Ticket 2 (roadmap 90).**

*Receiving files:* each attachment is downloaded right away (CDN links expire) to `.arthur/discord/media/<attachment id>-<cleaned file name>`. Its kind is set by:
- `IS_VOICE_MESSAGE` (1<<13) → `voice`, with `duration_secs` as `seconds`;
- `image/*` → `photo`;
- `video/*` → `video`;
- `audio/*` → `audio`;
- anything else → `file`.

The parts come in order: the files first, then the text as a `text` part. A download that fails becomes a `text` part saying why. A sticker or a message without text or files gets one line back.

*Sending files:* `channel.send` sends one multipart request with `payload_json` and `files[n]`. Before anything goes, it refuses: more than 10 files, a file over 20 MiB, a request over 25 MiB, or a missing or empty file. The 20 MiB per-file limit comes from Discord's reference, "Uploading Files", fetched today; the roadmap names only the 25 MiB request limit.

*Commands:* `/name text` in the owner's own, not-forwarded message goes to `host.commands.route` with `{ channel: "discord", place?, instance? }`. The reply goes through the outbox, sliced at 2000.

**Telegram beside it.** Both plugins can be on at once (vision, decision 21). A reply goes to the channel the message came from, through the reply's `channels`. Every notice goes to both, so it arrives twice.

What changes for the owner the day he switches to Discord only:
- set `telegram({ enabled: false, ... })`;
- old chats stay in Telegram;
- a slice waiting in `.arthur/telegram/outbox/` stays there unsent;
- commands have the same names, but they are typed and there is no menu;
- once project agents exist, a project's `chat` changes from a Telegram topic to a Discord channel id.

## Not available directly
- **What is missing.** The tests need a fake Discord gateway, and Node has a `WebSocket` client but no WebSocket server. I looked at Node 24's built-ins; the styleguide allows only `typescript` and `@types/node` as dev dependencies. I ran an inline check: a raw `node:http` `upgrade` handler with a SHA-1 accept, one text frame each way and a 4014 close frame. Node's own `WebSocket` client took the Hello, sent a masked heartbeat and reported close code 4014.
- Option 1: a minimal RFC 6455 server, about 80 lines, in `packages/discord/test/fake-discord.ts` beside the fake REST API, using only `node:http` and `node:crypto`. Cost: test code only. Risk: framing bugs in the fake, kept low because the real client checks every frame.
- Option 2: inject a socket factory so tests pass a fake object. Cost: one seam in `src/`. Risk: the real `WebSocket` path (URLs, close codes, framing) is never tested, against the styleguide's "real files, only outside services faked".
- Option 3: the `ws` package as a dev dependency. Cost: one package. Risk: the structure test (`test/structure.test.ts:168-182`) refuses it.
- Recommendation: Option 1. The plan follows it.

## Files
Ticket 1 (roadmap 89):
- `packages/discord/package.json`: `@arthur/discord`, Apache-2.0, `exports` `.` → `./src/discord.ts`, `./options` → `./src/discord-options.ts`, no dependencies.
- `packages/discord/src/discord.ts`: the plugin. Setup reads the four variables per bot and refuses a malformed token (three dot-separated base64url parts) or id (a positive whole number below 2^64), naming the option and variable, never the value. It wires events to the outbox, provides `doctor`, and `start`/`stop` run the gateway.
- `packages/discord/src/discord-options.ts`: the option table `bots` (`name?`, `tokenEnv`, `guildIdEnv`, `userIdEnv`, `channelIdEnv`; at most one unnamed bot) and `apiUrl` (https, or http on loopback), modelled on `packages/telegram/src/telegram-options.ts`.
- `packages/discord/src/gateway.ts`: the connection, heartbeat, identify, resume, backoff, close codes, the session-start guard and the text-channel set.
- `packages/discord/src/rest.ts`: one authenticated call, with 429 `retry_after`, errors as one line with the token replaced, and a timeout.
- `packages/discord/src/receive.ts`: the filtering of `MESSAGE_CREATE`, forwards, the thread line and the `message-received` emit.
- `packages/discord/src/outbox.ts`, `slices.ts`: adapted copies of telegram's (2000-unit limit, Discord's error shape, `allowed_mentions`, `SUPPRESS_NOTIFICATIONS`).
- `packages/discord/src/discord-doctor.ts`: the four requirements.
- `packages/discord/docs/discord.md`: options, receiving, sending, setup, as `packages/telegram/docs/telegram.md` does.
- `packages/discord/test/fake-discord.ts`: the fake REST API and gateway (Option 1).
- `packages/discord/test/discord-shapes.json`, `fake-shapes.test.ts`: field lists from Discord's docs, with source URL and date, as in AR0581 (Gateway payload, Ready, Guild, Channel, Message, Attachment, User, Get Gateway Bot, Application).
- `packages/discord/test/gateway.test.ts`, `discord.test.ts`: the tests under How to test.
- `test/structure.test.ts`: `discord: <budget>` (question 1).
- `docs/setup.md` step 13; `arthur.config.example.ts`, header lines 3-6 and lines 463-476 (discord no longer planned, comment updated); `README.md` lines 11, 55, 66 and a Features line for discord; `arthur.mmd`, `docs/architecture/core-and-plugins.mmd`, `versions.mmd` (discord built); `docs/plugin-api.md` rows `channel.send` and `coordinator.silent` (discord added as a user, ticket 2 for `channel.send`); `spec/roadmap.md` entry 89 (threads line, session-start guard, "not reached is ok"); `CHANGELOG.md`.

Ticket 2 (roadmap 90):
- `packages/discord/src/media-in.ts`, `media-out.ts`; `receive.ts` gains attachments and commands; `discord.ts` provides `channel.send`.
- `packages/discord/test/media.test.ts`, `commands.test.ts`; `fake-discord.ts` gains the CDN download and the multipart parse.
- `packages/discord/docs/discord.md`, "Phone commands" and "Sending files"; `spec/roadmap.md` entry 90 (the 20 MiB per-file limit); `test/structure.test.ts` budget; `CHANGELOG.md`.

## Risks
- **The token reset by Discord after 1000 IDENTIFYs.** Every reconnect tries resume first, op 9 waits 1 to 5 s, and the session-start guard stops identifying below 50 remaining. Tests: a fake that drops the connection 20 times sees at most one IDENTIFY plus resumes, and a fake reporting `remaining: 10` sees none.
- **The token leaking into logs.** It goes only in the `Authorization` header and the Identify payload. Errors replace it, and the core's secret names (`secret-names.ts`) hide env values too. A test greps stderr and notices for the token after a 4004 and a 401.
- **The token sent to a stranger.** A gateway URL that is not `wss:` (or `ws:` on loopback) is refused before connecting.
- **A Discord outage at boot refusing `arthur run`.** A Discord that does not answer is `ok (not reached)`; only a definite 401 or a missing intent flag is a miss (question 4).
- **Messages lost while Arthur restarts.** The gateway does not replay them (question 2).
- **Pings from text the coordinator relays.** `allowed_mentions: { parse: [] }` on every send.
- **Two outbox copies**, telegram's and discord's: the styleguide prefers copying to a shared helper before the second example. A third channel (Slack) is the point to move it into the core, as a recorded API decision.
- **The fake drifting from Discord.** `fake-shapes.test.ts` checks every fake answer against `discord-shapes.json`, as for telegram (AR0581).
- **Plain-text `/jobs` in the Discord client.** I expect a `/` text that matches no app command to be sent as text [INFERENCE: not tried in a client]. Setup step 8 has the owner type `/jobs` once. If the client blocks it, question 3's option B is the fix.
- **This planning job made no commit.** The planner role forbids edits and commits; plan.md is written from this message.

## How to test
- **Done means: plan.md approved, with a plain-words section and the worker tickets.** The owner reads "In plain words" and the tickets above, and answers Open questions.

Proposed ticket 1 (roadmap 89):
- *Load refusals:* a bot without one of its four variables; an unknown key; two unnamed bots; a malformed token or id, never printing it.
- *Gateway (fake, `until` waits, a short `heartbeat_interval` in Hello, no fixed waits):*
  - identify with intents 33281;
  - a missed ACK → close (not 1000) and resume;
  - op 7 resumes;
  - op 9 false identifies after a backoff, op 9 true resumes;
  - 4004 stops with no token in the output;
  - 4014 names MESSAGE_CONTENT and the portal switch;
  - the reconnect loop and the session-start guard, as under Risks;
  - stop closes with 1000.
- *Receiving:* the main channel → no `place`; a project channel → its id; dropped: another user, another server, the bot itself, a webhook, an edit; a thread → the line in the main channel; a forward → the marked text, with a hidden sender and a name with `]` and control characters.
- *Sending:* the reply-by-`channels` rule; silent mode holds a notice; quiet hours set flag 4096; 2001 characters → two slices cut at a line break; a 429 waits `retry_after`; a 404 slice set aside and said once; a known `place` used, an unknown one sent to the main channel; the outbox survives a restart.
- *Doctor:* each requirement ok and missing; an unreachable API is `ok (not reached)`; the third-member and no-2FA lines with their fixes.
- *Smoke run:* `arthur doctor` and `arthur run` in a temporary home against the fake, plus the owner's real setup per step 8.
- `npm test` and `npm run check`, each in one call with a 1800 s timeout.

Proposed ticket 2 (roadmap 90):
- *Receiving files:* a photo, a video, a voice message (`seconds` from `duration_secs`), audio, a file, an attachment alone, a failed download.
- *Sending files:* refused before any send: 11 files, a 21 MiB file, 26 MiB in total, a missing file; a send of 3 files is one multipart request with `files[0..2]`.
- *Commands:* `/jobs` routed with `channel` and `place`; an unknown command gets the registry's line; a forwarded `/stopall` is not run; an edit to `/stopall` runs nothing; a reply over 2000 characters is sliced.
- *Smoke run:* `arthur send` with a PNG against the fake.

## Open questions
- **1. Discord's first line budget** (yours to set; telegram's is 641). Option A: 750 at ticket 1, 900 at ticket 2 (950 if 2B). Option B: 650, then 800, a tighter fit that pushes edge cases out. Recommendation: A, from per-file estimates (gateway about 180 lines, outbox about 140).
- **2. Messages written while Arthur restarts.** Discord does not replay them. Option A: they are lost, as roadmap 89 stands; the "coordinator up" notice tells you when Arthur is back. Option B: at start, fetch the last 10 minutes of the main and project channels, as Telegram's backlog does. This needs one more permission, Read Message History, and about 40 lines. Recommendation: B.
- **3. Command menu.** Option A: commands are typed as plain text, as roadmap 90 says, with no menu. Option B: Discord's own `/` menu, with app commands registered and answered over the same outbound connection (no endpoint), about 80 lines as a later ticket 3. Recommendation: A now, B only if typing proves awkward.
- **4. A refused token or the intent switched off.** Option A: critical, as AR0134 decided; `arthur run` refuses to start, terminal included. Option B: not critical; Arthur starts, and the doctor line comes through Telegram or the terminal. Recommendation: B. With A, a token Discord resets takes the whole coordinator down. This changes your 2026-10-18 decision.
- **5. Telegram after the switch.** Option A: both on for good, with every notice arriving twice. Option B: both for a trial week, then `telegram({ enabled: false })`. Option C: Telegram off on day one. Recommendation: B.