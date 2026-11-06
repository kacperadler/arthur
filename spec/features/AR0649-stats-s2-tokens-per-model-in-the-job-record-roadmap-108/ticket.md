# AR0649 - Stats S2: tokens per model in the job record (roadmap 108)

```json
{
  "id": "AR0649",
  "title": "Stats S2: tokens per model in the job record (roadmap 108)",
  "date": "2026-11-06"
}
```

## Description

Ticket S2 of the AR0480 plan, which the owner approved with every recommendation on 2026-11-06 (AR-D523): a stats plugin that shows the tokens, cost and time of every job and of the coordinator, per role, ticket and project. The owner reads this branch as a GitHub pull request before it is merged (AR-D518, AR-D519).

## Goal

Entry 108 (Approach sections 1 to 3 where they name the core): `usage` in the job record and `JobRecord` beside `cost`, the fake agent's `usage` option; a change to the frozen API (51) recorded in `docs/plugin-api.md`; core about +30 lines, core/testing +3, as `spec/features/AR0480-plan-a-stats-plugin-token-use-cost-and-time-of-every-job-and-of-the-coordinator/plan.md` lays it out (section 7 item for S2).

- Kind: feat

## Done means

- Every point of S2 in the plan's Approach and Files works, each shown by a test that fails when it is removed; the plan's "How to test" lines for S2 hold.
- The docs of every command, option and host member it adds or changes say what it does.
- `npm run check` and `npm test` pass; each line budget raised names its new number in the final message.

## Scope

In:
- the core and core/testing files the plan's Files name for 108.

Out:
- The other tickets of the AR0480 plan: their own tickets.
- The activity log (AR0527), budgets, `arthur usage`.

## Decisions

