# AR0279 - An eval turn gets the coordinator's role but not its context, nor a time of day

```json
{
  "id": "AR0279",
  "title": "An eval turn gets the coordinator's role but not its context, nor a time of day",
  "date": "2026-10-22",
  "after": [
    "AR0278"
  ]
}
```

## Description

the live coordinator reads `arthur coordinator context` before every turn: its role, the board digest, the jobs by state, the plugins' context lines and the local time. In a run the real CLI refuses (the eval session), so the turn's system prompt is the role and criteria alone, built for the main project, not the fixture's board, and the agent's clock is the machine's. A scenario whose procedure depends on the board in the context, or on the hour (night answers, quiet hours), cannot be replayed as the coordinator sees it.

## Goal

An eval turn sees the coordinator's context for the fixture (its board, the plugins' lines) and a scenario-set time of day, so scenarios that hang on the board or on night/quiet hours can be replayed as the coordinator sees them.

- Kind: improvement

Evidence:
- `packages/develop/src/eval-command.ts` (`host.jobs.prompt("coordinator")`)
- Found by: 2026-10-22-ar0276-evals-runner-eda48620 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: orchestration provides the context for a given checkout (its board and visions, no live jobs), develop appends it for the fixture's copy; and a scenario `hour`, the session's `TZ` set so the local hour is that one, as the predecessor's evals did.
- `npm test` and `npm run check` pass.

## Scope

In:
- orchestration provides the context for a given checkout (its board and visions, no live jobs), develop appends it for the fixture's copy; and a scenario `hour`, the session's `TZ` set so the local hour is that one, as the predecessor's evals did.

## Decisions

- 2026-10-22: Source: F3 of AR0276
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
- 2026-10-22: Coordinator (free hand): plugin API change accepted, board.digest and jobs.vision take an optional checkout folder, orchestration provides coordinator.checkoutContext.
- 2026-10-22: Coordinator (free hand): line budget raises accepted, core 5751 to 5753, orchestration 2223 to 2231, develop 628 to 650.
