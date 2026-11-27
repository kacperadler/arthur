# AR0715 - Two projects can share one chat without a refusal when one names the main bot and the other leaves the bot out

```json
{
  "id": "AR0715",
  "title": "Two projects can share one chat without a refusal when one names the main bot and the other leaves the bot out",
  "date": "2026-11-17"
}
```

## Description

Arthur refuses to start when two projects' agents would share one chat, but the check compares the bot's name as written: one project naming the main bot and another leaving the bot out pass, though both mean the same chat. One agent then never hears its chat. After this, a missing bot counts as the channel's main bot, and the setup is refused.

## Goal

The load-time refusal exists so two agents never share one place (roadmap 85 "Done means"). With this spelling the setup starts anyway, and one project's agent silently gets nothing.

Evidence (audit 2026-11-17):
- `packages/orchestration/src/sessions.ts:36`: the duplicate check compares the raw `chat.instance`; `sessionFor` at `sessions.ts:51` routes with `chat.instance ?? main[chat.plugin]`.
- A throwaway script calling `sessionList` on a `fakeHost`: shop `{ plugin: "telegram", place: "42" }`, blog `{ plugin: "telegram", instance: "first", place: "42" }`, `channel.main` `first`. Output: `loaded: [ 'coordinator', 'agent:shop', 'agent:blog' ]`, and a message from bot `first` in 42 goes to `agent:shop`.

- Kind: fix

## Done means

- Two projects whose chats are the same bot and place, one naming the main bot and one leaving the bot out, are refused, in either order, with the line that names both projects and the place; once the channels have answered which bot is main (at start, or as the critical `arthur doctor` line that already refuses a chat with no `channel.send`).
- A test for each order fails before the change.
- Two projects on different places, or on different bots, still load.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/orchestration/src/sessions.ts`, or the doctor check beside the `channel.send` one: the comparison resolves a missing bot to `channel.main`.
- Its tests in `packages/orchestration/test/`.

Out:
- Routing itself, which stays as it is.

## Decisions

- 2026-11-17: Source: audit spec/quality/2026-11-17.md
- 2026-11-17: Source: F2 of AR0705
- 2026-11-23: AR0715 approved: two projects sharing one chat are refused however the bot is named, budget $10; the owner: "another project's decision another project's decision AR-D703 AR-D704 AR-D705 AR-D706 AR-D707 another project's decision yes" (AR-D705)
