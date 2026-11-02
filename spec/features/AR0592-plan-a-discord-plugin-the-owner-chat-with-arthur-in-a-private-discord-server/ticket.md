# AR0592 - Plan: a discord plugin, the owner chat with Arthur in a private Discord server

```json
{
  "id": "AR0592",
  "title": "Plan: a discord plugin, the owner chat with Arthur in a private Discord server",
  "date": "2026-10-30"
}
```

## Description

The owner asked on 2026-10-30: "I wanna add discord plugin to this project, can you create a task for that, at first we have to plan this, and i have to understand how this will work".

Discord is already the first-version channel the owner picked (vision, decision 21; AR0134), and `spec/roadmap.md` entries 89 (gateway, text in and out) and 90 (media and phone commands) describe it. No `packages/discord/` exists yet. The telegram plugin (`packages/telegram/`) is the channel it follows: the same `message-received`, `channel.send`, `parts`, `notice` and silent-mode contract.

## Goal

A plan the owner reads and understands before any code: how the Discord plugin works and what he does to set it up.

- Kind: feat
- Plan: yes

The plan explains, in plain words first, then in detail:

- What the owner sees: one private server, a main channel for the coordinator, one channel per project (ready for the project agents of roadmap 85 to 88), what happens to text, photos, voice notes, videos and files, how `/jobs`-style phone commands work, silent mode and quiet hours.
- What he does once: create the server and the bot in Discord's developer portal, the intents and permissions, the invite link, 2FA, the four variables (token, server id, his user id, main channel id) in the env file, the `discord(...)` entry in `arthur.config.ts`, and how to check it works (`arthur doctor`).
- How it works inside: the outbound gateway over Node's built-in `WebSocket`, heartbeat, resume and reconnect, the REST calls, no runtime dependency, nothing listening on the internet; how it fits AR0589's config folders (a project's `chat` in its folder).
- Security: only the owner's user id on that one server, the least intents and permissions, the token never in a log or a message, never paste a secret in a channel.
- Whether Telegram stays on beside it, and what changes for the owner the day he switches.
- The split into worker tickets (roadmap 89, then 90), each with its scope, tests against a fake gateway and REST API in Discord's documented shape, and the discord package's first line budget, which is the owner's decision.
- The questions the owner must answer before the build, each with options and a recommendation.

## Done means

- `plan.md` in this folder, approved by the owner, with a plain-words section at the top a non-programmer can follow, and the worker tickets it proposes.

## Scope

In:
- The plan only: `plan.md`. No code.

Out:
- Slack, Signal, WhatsApp; the project agents themselves (roadmap 85 to 88).

## Decisions
- 2026-10-30: Yes, plan it now; the owner: "by recommendation: G5188" (AR-D401)
- 2026-10-30: AR0592 opened and its planner started, on the owner own request; the owner: "I wanna add discord plugin to this project, can you create a task for that, at first we have to plan this, and i have to understand how this will work" (AR-D401)
- 2026-10-30: Plan approved by the owner: plan.md at b9554741; the owner: "AR-D402 1" (AR-D402)
- 2026-10-31: Merge AR0592 ticket 1 (discord plugin, text) now; the owner: "Go all with recommendations" (AR-D408)
