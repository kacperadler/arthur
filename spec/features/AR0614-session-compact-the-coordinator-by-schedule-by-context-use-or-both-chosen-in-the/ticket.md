# AR0614 - Session: compact the coordinator by schedule, by context use, or both, chosen in the session options

```json
{
  "id": "AR0614",
  "title": "Session: compact the coordinator by schedule, by context use, or both, chosen in the session options",
  "date": "2026-11-03"
}
```

## Description

Today the `session` plugin compacts the coordinator's conversation only at set times (`compactAt`, 08:00, 13:00, 18:00). The owner wants to choose, in the `session` options of `arthur.config.ts`, what triggers a compaction: the schedule, the share of the context window the conversation uses (compact at X%), or both. This applies only to the conversations the owner talks with (the coordinator now, a project's own agent once roadmap 85 to 88 builds it); jobs (worker, reviewer, planner, audit, retro, onboarding) keep compacting as they do today.

## Goal

The owner asked on Discord, 2026-11-03: "I wanna be able to schedule when the conversation should be compacted but also set this like when the conversation is using X% of the context and be able to select which version of this is used and set this up by plugin. Only for coordinator and agents, workers etc. should work as to this time."

Evidence of today's behaviour: `packages/session/src/session-options.ts:11` (`DEFAULTS`: `compactAt`, `compactWaitSeconds`), `packages/session/src/session.ts:91-93` (the next compaction is the next `compactAt` time), `arthur.config.example.ts:215-216`.

- Kind: feat
- Plan: yes

## Done means

- A `session` option picks the trigger: by schedule only (today's behaviour, the default, so an unchanged config behaves as before), by context use only, or both (whichever comes first). A second option sets the percentage (a whole number, 1 to 99); a bad value or an unknown trigger is refused at config load with a message naming the option, like every other session option.
- By context use: once a coordinator turn ends with its conversation at or above the percentage, the same compaction as a scheduled one runs (handoff written first, a failed write withdraws it, it waits for an idle session as `compactWaitSeconds` says), and it does not fire again until the conversation has been compacted.
- The plan finds where the coordinator's context use can be read (OMP's own session data or the turn extension) and says how it is read; if OMP gives no such number, the plan says so and the owner decides before any code.
- The design leaves a place for a project agent's conversation to use the same options when roadmap 85 to 88 builds it; nothing for project agents is built here.
- Jobs are not touched: no job's prompt, launch or compaction changes, and a test shows a job's launch is the same with either trigger.
- Tests: each trigger fires a compaction when it should and not otherwise; the percentage at 1, 99, 0 and 100 (refused); a repeated threshold crossing before the compaction fires once; the default config compacts only on the schedule. `docs` (`packages/session/docs/session.md`) and `arthur.config.example.ts` show the new options. `npm run check` and `npm test` pass.

## Scope

In:
- `packages/session/src/session-options.ts`: the trigger and percentage options, their checks and defaults.
- `packages/session/src/session.ts`: the context-use trigger beside the schedule.
- `packages/session/src/turn-extension.ts` (or where the plan finds the context use): reading the conversation's context use after a turn.
- `packages/session/docs/session.md`, `arthur.config.example.ts`: the new options.
- `packages/session/test/`: the tests above.

Out:
- Project agents' own conversations (roadmap 85 to 88): they reuse these options when built.
- Any change to how jobs compact.

## Decisions
- 2026-11-03: AR0614 approved: a planner writes the plan first, after the usage reset; it joins the tasks counter (18 -> 19); the owner: "AR-D471 - 1" (AR-D471)

