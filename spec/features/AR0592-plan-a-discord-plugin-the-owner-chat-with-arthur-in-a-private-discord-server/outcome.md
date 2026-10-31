# AR0592 - Outcome

- Merged: 2026-10-31, `84170c00`
- Branch: arthur/2026-10-31-worker-5c004deb
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $9.53, reviews $0.81; review rounds 2

## What went in

- `packages/discord/package.json`: the `@arthur/discord` package, Apache-2.0, exports `.` and `./options`, no dependencies.
- `packages/discord/src/discord.ts`: the plugin. Reads and checks each bot's four variables, never printing a value. Sends replies (by `channels` and the bot their messages came through) and notices (unless silent mode holds them) through the outbox. Provides the doctor lines; `start` and `stop` run the gateway.
- `packages/discord/src/discord-options.ts`: the option table (`bots`, `apiUrl`) and its check.
- `packages/discord/src/gateway.ts`: the outbound WebSocket. Hello, heartbeat, Identify with intents 33281, resume, op 7 and op 9, backoff, the guard against using up session starts, the fatal close codes, and wss-only gateway addresses.
- `packages/discord/src/receive.ts`: the server's text channels, the owner-only filter, the forward mark, the line back for threads and files, the 10-minute backlog, and `seen.json` for text channels only.
- `packages/discord/src/rest.ts`: one authenticated REST call with a timeout; errors are one line with the token replaced, and carry the 429 `retry_after`.
- `packages/discord/src/outbox.ts`: telegram's outbox adapted. 2000-character slices, `allowed_mentions` empty, flag 4096 in quiet hours, sends only to the server's own channels, refused slices set aside, a 429 waited out and retried.
- `packages/discord/src/slices.ts`: cuts text at line breaks for Discord's 2000-character limit.
- `packages/discord/src/discord-doctor.ts`: four doctor lines per bot, none critical, each call within 5 s.
- `packages/discord/docs/discord.md`: options, the connection, receiving, sending, the outbox, the doctor, setting it up.
- `packages/discord/test/fake-discord.ts`: the fake REST API and a minimal WebSocket gateway on one loopback port, and the plugin loaded on a fake host against it.
- `packages/discord/test/discord-shapes.json`: Discord's documented field tables for every object the fake answers with.
- `packages/discord/test/fake-shapes.test.ts`: every fake answer checked against those field tables.
- `packages/discord/test/gateway.test.ts`: the gateway tests (heartbeat, resume, op 7 and op 9, 20 drops, the session-start guard, 4004 and 4014, wss only, stop with 1000).
- `packages/discord/test/discord.test.ts`: options, load refusals, receiving, the backlog, sending (including that the rate-limited slice itself goes and nothing is set aside), the outbox, multiple bots, the doctor.
- `test/structure.test.ts`: the discord line budget of 750.
- `test/option-tables.test.ts`: discord's options file and plugin added to the list it checks.
- `package-lock.json`: the new workspace added.
- `docs/setup.md`: step 13 covers Discord; the example-config note now names `@arthur/docker`.
- `docs/plugin-api.md`: discord added as a provider of `doctor` and a user of `coordinator.silent`.
- `arthur.config.example.ts`: discord counted as built, docker as the first planned import, the discord comment updated.
- `README.md`: Discord as a channel, a discord Features line, the Planned line and diagram updated; the Status and Next paragraphs merged to stay within 120 lines.
- `arthur.mmd`: discord shown as partly built, entry 89 listed.
- `docs/architecture/core-and-plugins.mmd`: the discord node says text built, media planned.
- `docs/architecture/versions.mmd`: the first-version node says discord's text is built and its media is to come.
- `spec/roadmap.md`: entry 89 gains Read Message History, doctor lines not critical with "not reached is ok", the session-start guard, the backlog, and the thread line.
- `spec/features/AR0592-plan-a-discord-plugin-the-owner-chat-with-arthur-in-a-private-discord-server/findings.md`: F1 and F2.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1364/1433 passed.

## Left open

- Deferred (client summary): F1. arthur.mmd's status lines are stale
- Deferred (client summary): F2. The Discord backlog reads at most 100 messages per channel
