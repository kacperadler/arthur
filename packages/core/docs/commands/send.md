# arthur send

Usage: `arthur send <file>... [--caption <text>] [--place <id>]`

Sends files to the owner through every enabled channel (on Telegram: `packages/telegram/docs/telegram.md`, "Sending files"), each by the plugin's own rules, and prints one line per channel, `<channel>: <what it sent>`, for example `telegram: sent 3 files in 2 messages`. A relative path is read from the folder `arthur send` runs in.

- `--caption <text>`: shown with the first message.
- `--place <id>`: where the files go on each channel, a Telegram topic's number or a Discord or Slack channel's id; a channel that has no such place sends to its allowed chat, as it does without `--place`.

Every channel checks the whole message before any channel sends: when one refuses it (too many files, a file over its size limit, a photo it would reject, a missing file), nothing is sent anywhere, and exit 1 prints `arthur send: nothing sent:` with each refusal as `<channel>: <reason>`, one per line. A channel whose send then fails prints `arthur send: <channel>: <error>` and the others still send; the exit code is 1. No token is ever printed.

Refused: no file or an unknown flag (exit 2 with the usage line); no channel enabled (`arthur send: no channel is enabled: no plugin provides channel.send; enable one, such as telegram, in arthur.config.ts`, exit 1); a config that does not load.

## Channels

Every channel plugin keeps one contract, so the core and the coordinator treat them alike (`@arthur/core/parts`):

- It provides `channel.send`: given `{ files, caption?, place? }` (absolute paths), it checks everything at once and throws every refusal, one per line, or answers a function that sends and resolves to its line. It sends to `place` when it names one of its places, else to its allowed chat.
- What the owner sends becomes one event `message-received` `{ channel, parts, place?, instance? }`: `channel` is the plugin's name, `place` where the message was written when it names one (a Telegram topic, a Discord or Slack channel), and `parts` what the message holds, in its order, each `{ kind: text | photo | video | voice | audio | file, path?, text?, mime, seconds? }`. A text or a caption is a `text` part with its `text` and `mime: "text/plain"`; any other is a file the channel saved under `.arthur/<channel>/`, with its `path`, its `mime`, and `seconds` when the channel gives a length. An album is several parts of one message. The channel transcribes, converts and reads nothing.
- The coordinator gets a message as one entry, `[via <channel>]` and each part's text under it, quoted, in order (`arthur coordinator --help`). Before that, the core asks `collect("message.part", part)` of the enabled plugins for each part that is not text: a plugin that handles the part's kind answers `{ text, reply? }`, or a promise of it, and any other undefined. The first claim in setup order replaces the part by its `text`, and its `reply` goes back to the owner through the channel and place the message came from (`coordinator-replied` answering the message). A part nobody claims is `[<kind>, <mime>, <seconds> s] (<path>)`, the length only when given. A `voice` part nobody claims is `[voice note not transcribed: the voice plugin is not enabled]`, and the channel says the same line to the owner. A claim that throws or rejects leaves the part as its saved path, followed on the same line by `; <plugin> failed: <error>`.
- Messages keep their order: one waits until every part of the ones before it is resolved, so a text sent after a voice note never overtakes it.
