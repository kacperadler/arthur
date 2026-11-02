# AR0606 - Discord T3: the phone commands as Discord application commands, suggested when the owner types /

```json
{
  "id": "AR0606",
  "title": "Discord T3: the phone commands as Discord application commands, suggested when the owner types /",
  "date": "2026-11-02"
}
```

## Description

When the owner types `/` in Arthur's Discord server, Discord lists the phone commands (`/jobs`, `/board`, `/usage`, ...) with their `about` line, as Telegram's command menu does. A picked command runs as a typed `/name text` runs today, and its reply comes back in the same channel.

## Goal

The owner asked, 2026-11-02, why Discord does not suggest the `/` commands. Discord suggests only registered application commands. Roadmap entry 90 (AR0602) chose plain text on purpose: "No application commands, so there is no interaction to answer" (`spec/roadmap.md:874`). The discord plugin calls no `/applications/{id}/.../commands` route (only `GET /applications/@me`, `packages/discord/src/discord-doctor.ts:23`). Telegram's bot already sets its menu from the registered phone commands at each start (`packages/telegram/src/menu.ts`).

This stays inside the vision (nothing listens on the internet): with no Interactions Endpoint URL set, Discord delivers a command as an `INTERACTION_CREATE` event over the gateway connection the plugin already holds, and the reply is an outbound `POST /interactions/{id}/{token}/callback`.

- Plan: yes
- Kind: feat

## Done means

- At each start of `arthur run`, each bot's guild commands are set (`PUT /applications/{application.id}/guilds/{guild}/commands`) to the phone commands the enabled plugins registered, each with its `about` and one optional string option for the text after the name, only when they differ from what the plugin's own record says it set; a refused call is one line on stderr and the next start tries again. Tests against the fake Discord, in the documented shapes.
- A command the owner picks (an `INTERACTION_CREATE` of type APPLICATION_COMMAND, from the owner's user, in the server and a channel the plugin answers) runs through the host's command registry as `/name text` does, with the same `channel`, `place` and `instance`; the reply answers the interaction (a deferred answer first when the command may take over 3 s, then the follow-up), and a reply longer than 2000 characters is sliced. An interaction from another user, server or channel is answered with a refusal and runs nothing. Each edge case has a test.
- The `/name text` typed as plain text keeps working as today.
- The bot's needed scope or permission (`applications.commands`) is in the setup steps of `packages/discord/docs/discord.md`, and `arthur doctor` says when the commands could not be set.
- Roadmap entry 90's "No application commands" line is updated, and nothing in the docs says the old thing.

## Scope

In:
- `packages/discord/src/`: the command set at start and the interaction's handling; the plan names the files.
- `packages/discord/test/`, the fake Discord, `packages/discord/docs/discord.md`, `spec/roadmap.md` entry 90.

Out:
- A command with options of its own beyond the one free text: the registry has no such shape.
- Slack's single `/arthur` command: its own entry.

## Decisions

<!-- - YYYY-MM-DD: one decision the human made, in one line. -->
