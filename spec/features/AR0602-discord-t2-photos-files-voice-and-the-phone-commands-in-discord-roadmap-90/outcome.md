# AR0602 - Outcome

- Merged: 2026-11-02, `e4225ba9`
- Branch: arthur/2026-11-02-worker-9c620b28
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $9.09, reviews $0.85; review rounds 2

## What went in

- packages/discord/src/media-in.ts: downloads each attachment of a message (and of a forward's snapshot) to `.arthur/discord/media/<id>-<name>` without a token, as `voice`/`photo`/`video`/`audio`/`file` parts; a failed download becomes a text part saying why.
- packages/discord/src/media-out.ts: `channel.send` for Discord; checks the whole message first (10 files, 20 MiB per file, 25 MiB in all, missing or empty file, 2000-character caption), checks the place with `GET /channels/{id}`, then sends one multipart message.
- packages/discord/src/receive.ts: files before text in `message-received`, `/name text` routed to the command registry with the reply through the outbox, sticker and empty-message line, a message counts as heard only after its downloads, the backlog heard one message at a time, oldest first, `idle()` for stop, and a failed message no longer stops the rest.
- packages/discord/src/discord.ts: provides `channel.send`; stop waits for the messages being handled before the outbox.
- packages/discord/src/rest.ts: sends a multipart form as-is, JSON otherwise.
- packages/discord/test/media.test.ts: tests for kinds, file names, order, no token to the CDN, failed downloads, a stop mid-download, backlog order and `seen.json` with a held download, the multipart send, places, quiet hours, each refusal and each limit, and a refused upload.
- packages/discord/test/commands.test.ts: tests for routing with place and instance, unknown and non-commands, forward/file/edit never run, a command from the backlog run once, slicing, and stop waiting for a command.
- packages/discord/test/discord.test.ts: the reply-line test now covers stickers and empty messages; new test for a failed message not stopping the rest.
- packages/discord/test/fake-discord.ts: the fake gains a CDN (a held download that a later `attach` finishes), the multipart parse in Discord's shape, `GET /channels/{id}` and `attach()`.
- packages/discord/test/fake-shapes.test.ts: checks the multipart answer, the channel lookup and a message with an attachment against `discord-shapes.json`.
- packages/discord/docs/discord.md: receiving files, "Sending files", "Phone commands", the dropped-message line, and `/board` in the setup check.
- README.md: discord shown as built; its media and commands removed from Planned; channels box green.
- arthur.mmd: discord built, entries 89 and 90 of 89-90, planned line trimmed, date 2026-11-02.
- docs/architecture/core-and-plugins.mmd: the discord node says text, media, /name text.
- docs/architecture/versions.mmd: discord listed as built in the first version.
- spec/roadmap.md: entry 90 names the 20 MiB per-file limit and its refusal.
- test/structure.test.ts: discord budget 900.
- arthur.config.example.ts: the discord comment says files, voice and phone commands work.
- docs/setup.md: step 13 says Discord has files and phone commands (entries 89 and 90).
- docs/plugin-api.md: `channel.send` provided by discord and telegram.
- packages/core/docs/commands/send.md: points to Discord's "Sending files" beside Telegram's.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1403/1474 passed.

## Left open

- Findings: none; no findings.md on this ticket.
