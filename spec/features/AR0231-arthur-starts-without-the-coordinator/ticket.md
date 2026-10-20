# AR0231 - Arthur starts without the coordinator

```json
{
  "id": "AR0231",
  "title": "Arthur starts without the coordinator",
  "date": "2026-10-20"
}
```

## Description

Today the core refuses a config without the `orchestration` plugin, or with it disabled (`packages/core/src/host.ts:35,92-93`; `spec/vision.md:9`, decision 14 at `spec/vision.md:226`; roadmap entry 4 at `spec/roadmap.md:50-51`). The owner asked what Arthur would do with only plugins such as uptime, YouTrack and Telegram, and wants that to be possible: a light mode with no AI, where self-running plugins work (uptime checks sites, Telegram sends its notices) and their commands run from the terminal, but nothing answers the owner's messages and there is no board work, no workers.

## Goal

A config without `orchestration`, or with `enabled: false` on it, loads and runs; Arthur then works as a watchman and a toolbox.

- Plan: tak

## Done means

To be decided when the ticket is taken up (the owner, 2026-10-20: "later, at the very end"). Known so far:
- The core's refusal of a missing or disabled `orchestration` goes; `session`, which `requires: ["orchestration"]`, is still refused without it, naming it.
- What a channel does with an owner's message when no coordinator takes it (a reply saying no coordinator runs, or nothing) is the owner's call.
- `arthur doctor`, `arthur setup` and `arthur config check` say plainly that the coordinator is off.
- `spec/vision.md` (line 9, decision 14, the plugin table) and roadmap entry 4 change only on the owner's word.

## Scope

In:
- `packages/core/src/host.ts`, its tests, `docs/plugin-api.md`, the core's docs; the vision and roadmap once the owner rewords them.

## Decisions

- 2026-10-20: The owner wants a mode without the coordinator ("tak"), but not now: it goes at the very end of the roadmap, after AR0182, and is decided then.
