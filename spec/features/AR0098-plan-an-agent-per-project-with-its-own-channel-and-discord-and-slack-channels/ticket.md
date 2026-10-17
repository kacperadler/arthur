# AR0098 - Plan: an agent per project with its own channel, and Discord and Slack channels

```json
{
  "id": "AR0098",
  "title": "Plan: an agent per project with its own channel, and Discord and Slack channels",
  "date": "2026-10-17",
  "after": [
    "AR0099"
  ]
}
```

## Description

The owner's idea (2026-10-17, Telegram): instead of one coordinator over every project, an agent per project that gets everything about that project plus its folder, works the same way, and talks to the owner over its own channel. Also Discord and Slack as channel plugins; Teams left out for now.

## Goal

A plan the owner approves before any code: whether a per-project agent replaces the coordinator, sits beside it, or is a config choice, and where Discord and Slack go in the roadmap. Vision decision 10 ("the coordinator is always there") and decision 3 ("one channel interface") are what it touches.

- Kind: improvement
- Plan: tak

## Done means

- A plan in this folder comparing three options, each with what the owner sees and what it costs: (A) per-project agents only, no coordinator; (B) the coordinator plus a per-project agent, each project's chat (a Telegram topic, a Discord channel, a Slack channel) routed to that project's agent, the coordinator keeping `maxAgents` across projects, the morning report and cross-project work; (C) a config switch between one coordinator and per-project agents.
- For each: how `maxAgents` and the restart and compaction of several always-on sessions work, the cost of several sessions, and which roadmap entries (23 to 27, 41, 47 to 50) change.
- Discord (gateway, outbound connection) and Slack (Socket Mode, outbound connection) as channel plugins under decision 3, with no webhook and nothing exposed to the internet; their place in the later-plugins order.
- The vision and roadmap edits proposed, not made: the vision is the owner's.

## Scope

In:
- The plan only.

Out:
- Code; Teams.

## Decisions

- 2026-10-17: The owner: Discord and Slack as channels, certainly; Teams not for now.
- 2026-10-17: Coordinator's recommendation to the owner: option B.
- 2026-10-17: The owner chose option B: the coordinator plus an agent per project, each with its own chat.
- 2026-10-17: The owner on why B: later, for companies, the coordinator is the CEO who directs and assigns work, and each project agent is a department lead; the plan keeps that hierarchy open (agents above projects may be added later) without building it now.
- 2026-10-17: Plan approved by the human: plan.md at 3c2c875.
- 2026-10-17: The human: start only once CI on GitHub is green (AR0099).
- 2026-10-17: The human chose /arthur <name> <text> on Slack (the plan's Option 1).
