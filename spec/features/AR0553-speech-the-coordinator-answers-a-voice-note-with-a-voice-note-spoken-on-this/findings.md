# AR0553 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Voice notes pile up in .arthur/speak/

- Kind: chore
- Found by: 2026-11-10-worker-042e7671 (worker), 2026-11-10
- Where: `packages/speak/src/say.ts:38`
- What: every reply to a voice note leaves its `<uuid>.ogg` in `.arthur/speak/` for good (about 5 to 20 KB a reply in the smoke run); nothing removes them, and manage's daily prune does not know the folder.
- Suggestion: remove a voice note older than a few days at each `speak.say`, or once orchestration's send resolved; keep `arthur say --out` files out of it, as they leave the folder.
- Status: open

## F2. Discord sends the reply's voice note as a plain attachment

- Kind: feat
- Found by: 2026-11-10-worker-042e7671 (worker), 2026-11-10
- Where: `packages/discord/src/media-out.ts:6`
- What: a Discord voice message (IS_VOICE_MESSAGE) is a `voice` part, so the coordinator's reply to it goes back as the `.ogg` file through Discord's `channel.send`, which posts it as an ordinary attachment, not as a voice message. The ticket's Scope leaves Discord's voice out.
- Suggestion: send an `.ogg` file with the message flag 8192 and the attachment's `duration_secs` and `waveform`, as Discord's voice messages need; outside that, no change.
- Status: open

## F3. The voice note goes by the main Telegram bot, the text by the bot the message came through

- Kind: fix
- Found by: 2026-11-10-worker-042e7671 (worker), 2026-11-10
- Where: `packages/telegram/src/telegram.ts:70`
- What: `channel.send` sends by the unnamed bot, else the first, to its chat. A voice note to a named bot (`instance`) gets its text reply from that bot (`through`, `telegram.ts:49`) but its voice note from the main bot, in the main bot's chat.
- Suggestion: let `channel.send` take the `answers` (or an `instance`) and pick the bot as `through` does; orchestration's voice reply (`packages/orchestration/src/voice-reply.ts`) passes the answers it already has.
- Status: open

## F4. Markdown, paths and links are read aloud as written

- Kind: ux
- Found by: 2026-11-10-worker-042e7671 (worker), 2026-11-10
- Where: `packages/speak/src/say.ts:36`
- What: the reply's text goes to piper as it is, so a code span, a file path, a URL or a list's `-` is spoken symbol by symbol (in the smoke run `AR0081` came back from whisper as "a rezero-zero-siem jeden").
- Suggestion: before piper, drop Markdown marks and code spans and say a link by its text only; the text reply stays as it is.
- Status: open

## F5. A restart while a voice note is made loses it

- Kind: fix
- Found by: 2026-11-10-worker-042e7671 (worker), 2026-11-10
- Where: `packages/orchestration/src/voice-reply.ts:10`
- What: the voice step runs in memory after the reply moved to `outbox/sent/`; `arthur run` stopping before piper and the send end drops it with no line to the owner (the text went already).
- Suggestion: mark a reply whose voice note is pending in `outbox/` until it went or its line was sent, and finish it at the next start.
- Status: open

## F6. The voice note can go before its text, or without it

- Kind: fix
- Found by: 2026-11-10-review-f626dbca (review), 2026-11-10
- Where: `packages/orchestration/src/voice-reply.ts:13`
- What: Telegram sends the text through its outbox, which keeps a failed slice for the next try or start, while `channel.send` sends the voice note at once. When `sendMessage` fails, the voice note goes alone, though the docs say it goes after the text; the order holds today only because speaking takes seconds.
- Suggestion: let a channel take the voice note through its own outbox, behind the reply's text slices (a `voice` field on `coordinator-replied`, or a send that queues), so the voice note never overtakes its text; outside that, no change.
- Status: open
