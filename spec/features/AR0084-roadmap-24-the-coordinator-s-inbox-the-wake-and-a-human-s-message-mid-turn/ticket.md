# AR0084 - Roadmap 24: the coordinator's inbox, the wake, and a human's message mid-turn

```json
{
  "id": "AR0084",
  "title": "Roadmap 24: the coordinator's inbox, the wake, and a human's message mid-turn",
  "date": "2026-10-16"
}
```

## Description

Roadmap entry 24 (`spec/roadmap.md`, "The coordinator's inbox and the wake on job end"). The human wants the mid-turn part done well: a message he sends while the coordinator is answering joins that answer, so nothing he asked is skipped and the coordinator does not change course without saying so.

## Goal

The human writes freely and gets one reply that answers everything since the last one (vision: one human directs many agents through one coordinator).

- Kind: feature
- Plan: tak

## Done means

- Entry 24's Delivers and Done means, as the plan the human approves settles them.
- The plan answers first, each with the option chosen and why: where a mid-turn message enters (after the next tool call, or held to the turn's end and the turn resumed), how the turn knows which messages it has answered, what happens to a turn that already wrote its reply, a turn with no tool call left, a message that changes or cancels what the turn is doing, several messages in a row, a wake or schedule message (waits), and a coordinator restart mid-turn (nothing lost or answered twice).
- Each case above has a test with the fake agent.
- `npm test` and `npm run check` pass.

## Scope

In:
- The orchestration plugin's inbox (entry 24), the coordinator role's reply rule.

Out:
- Workers' steer (entry 17, merged).

## Decisions

- 2026-10-16: The human: in Arthur this must be thought through and planned first. Plan job before any worker; the human approves the plan.
