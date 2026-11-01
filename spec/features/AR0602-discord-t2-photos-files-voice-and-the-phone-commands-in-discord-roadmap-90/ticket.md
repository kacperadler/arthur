# AR0602 - Discord T2: photos, files, voice and the phone commands in Discord (roadmap 90)

```json
{
  "id": "AR0602",
  "title": "Discord T2: photos, files, voice and the phone commands in Discord (roadmap 90)",
  "date": "2026-11-01",
  "machine": "local"
}
```

## Description

The second build of the approved Discord plan (AR0592, AR-D402). Today Discord handles only text. After this ticket, a photo, file, video or voice note sent in the owner's Discord server reaches the coordinator, Arthur's own files (`arthur send`) go out in Discord, and `/name text` phone commands work there as they do in Telegram.

## Goal

Finish roadmap entry 90 as `spec/features/AR0592-plan-a-discord-plugin-the-owner-chat-with-arthur-in-a-private-discord-server/plan.md` lays out under "Ticket 2 (roadmap 90)" and under Files, "Ticket 2". That plan is the source of truth. It moves the vision's discord row from "partly built" to built. Evidence that it is missing: `README.md` line 46 says "media and the phone commands planned".

- Kind: feat

## Done means

- Receiving:
  - Each attachment is downloaded at once to `.arthur/discord/media/<attachment id>-<cleaned file name>`.
  - Its kind is set by `IS_VOICE_MESSAGE`, which gives `voice` with `seconds`. Otherwise by MIME type: `photo`, `video` or `audio`, else `file`.
  - The parts come in order: the files first, then the text.
  - A download that fails becomes a `text` part that says why.
  - A sticker, or a message with neither text nor files, gets one line back.
- Sending: `channel.send` with files makes one multipart request (`payload_json`, `files[n]`). Before anything goes out it refuses:
  - more than 10 files;
  - a file over 20 MiB;
  - a request over 25 MiB;
  - a missing or empty file.
- Commands:
  - `/name text` in the owner's own message that is not forwarded goes to `host.commands.route` with `{ channel: "discord", place?, instance? }`.
  - The reply goes through the outbox, sliced at 2000 characters.
  - A forwarded `/name` is not run.
- Tests run against the fake Discord, which gains the CDN download and the multipart parse in Discord's documented shape. Every refusal and limit has a test that fails when the behaviour is removed.
- Docs: `packages/discord/docs/discord.md` gains "Phone commands" and "Sending files". The README line 46 and the diagrams say discord is built. `spec/roadmap.md` entry 90 notes the 20 MiB per-file limit. `CHANGELOG.md` is updated.
- `npm run check` and `npm test` pass; the discord budget in `test/structure.test.ts` holds. The plan sets 900 after this ticket, per AR-D402.

## Scope

In:
- `packages/discord/src/media-in.ts`, `media-out.ts`: new.
- `packages/discord/src/receive.ts`: attachments and commands.
- `packages/discord/src/discord.ts`: provides `channel.send`.
- `packages/discord/test/media.test.ts`, `commands.test.ts`, `fake-discord.ts`.
- `packages/discord/docs/discord.md`, `README.md`, `arthur.mmd`, `docs/architecture/core-and-plugins.mmd`, `docs/architecture/versions.mmd`, `spec/roadmap.md`, `CHANGELOG.md`, `test/structure.test.ts`.

Out:
- Threads and forum posts stay unread, as in ticket 1.
- Turning Telegram off is the owner's step, one week after Discord is on (AR-D402).
- Project agents in project channels: roadmap 85 to 88.

## Decisions

