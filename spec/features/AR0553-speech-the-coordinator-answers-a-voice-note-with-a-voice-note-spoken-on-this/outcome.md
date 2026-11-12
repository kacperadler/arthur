# AR0553 - Outcome

- Merged: 2026-11-12, `17dc9ed0`
- Branch: arthur/2026-11-10-worker-042e7671
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS, review-4.md PASS, review-5.md PASS
- Cost: worker $26.55, reviews $6.14; review rounds 5

## What went in

- README.md: lists **speak**; the diagram's media box names it.
- arthur.config.example.ts: imports `speak` and shows `speak({ voices, maxChars, timeoutSeconds })` with comments, under main's header.
- arthur.mmd: a speak node among channels and media, and its own `class speak built;` line.
- docs/architecture/core-and-plugins.mmd: speak in Media, with orchestration asking `speak.say` and `channel.send` through the host; in the first-version class line.
- docs/architecture/versions.mmd: speak among the first-version plugins.
- docs/plugin-api.md: a `speak.say` row, orchestration as a caller of `channel.send`, and the `voice note not sent` line under `coordinator-replied`.
- package-lock.json: links the `@arthur/speak` workspace at 0.1.0.
- packages/orchestration/docs/commands/coordinator.md: describes the voice-note reply, its order, its failure line and no-speak behaviour.
- packages/orchestration/src/inbox.ts: the sweep hands each emitted reply to the voice-reply step.
- packages/orchestration/src/voice-reply.ts: speaks a reply that answers a voice note and sends it through that channel's `channel.send`, one reply at a time; otherwise one `voice note not sent: <why>` line.
- packages/orchestration/test/voice-reply.test.ts: tests sending, text-only and media-only replies, unanswered voice notes, a broken answered message, several channels, one voice note at a time, each failure, a channel without `channel.send`, speak not enabled, and the running inbox's sweep.
- packages/speak/package.json: the `@arthur/speak` package, 0.1.0, with `.` and `./options` exports.
- packages/speak/docs/speak.md: the plugin's page.
- packages/speak/docs/commands/say.md: the `arthur say <text> [--out <file>]` page.
- packages/speak/src/speak.ts: the plugin; provides `speak.say`, registers `say`, and gives the doctor requirements.
- packages/speak/src/speak-options.ts: options `voices`, `maxChars` and `timeoutSeconds`, their checks and defaults.
- packages/speak/src/speak-tools.ts: the requirements for piper, each voice and ffmpeg, with their fixes.
- packages/speak/src/say.ts: one text at a time, Polish or English detection, piper to WAV, ffmpeg to OGG/Opus, with cleanup.
- packages/speak/src/say-command.ts: `arthur say`, which prints the path or moves the file to `--out`, leaving no copy behind.
- packages/speak/test/speak.test.ts: tests against a fake piper and ffmpeg for every behaviour above.
- packages/telegram/docs/telegram.md: `.ogg` files go as voice notes, each alone.
- packages/telegram/src/media-out.ts: `.ogg` maps to `sendVoice`, one message per voice note.
- packages/telegram/test/fake-bot-api.ts: answers `sendVoice` with a documented Voice.
- packages/telegram/test/fake-shapes.test.ts: shape-checks the `sendVoice` answer.
- packages/telegram/test/media.test.ts: tests voice-note ordering, captions and topics.
- packages/telegram/test/telegram-shapes.json: records the Bot API's Voice type.
- spec/vision.md: a speak row in the plugin table.
- spec/features/AR0553-speech-the-coordinator-answers-a-voice-note-with-a-voice-note-spoken-on-this/findings.md: F1–F6, open.
- test/option-tables.test.ts: speak in main's sorted `PLUGINS` and `TOOLS` lists.
- test/structure.test.ts: budgets orchestration 2918, telegram 682, speak 248.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1707/1778 passed.

## Left open

- Deferred (client summary): F1. Voice notes pile up in .arthur/speak/
- Deferred (client summary): F2. Discord sends the reply's voice note as a plain attachment
- Deferred (client summary): F3. The voice note goes by the main Telegram bot, the text by the bot the message came through
- Deferred (client summary): F4. Markdown, paths and links are read aloud as written
- Deferred (client summary): F5. A restart while a voice note is made loses it
- Deferred (client summary): F6. The voice note can go before its text, or without it
