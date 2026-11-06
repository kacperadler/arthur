# AR0651 - Stats S4: the merged-ticket report moves from manage to stats (roadmap 110)

```json
{
  "id": "AR0651",
  "title": "Stats S4: the merged-ticket report moves from manage to stats (roadmap 110)",
  "date": "2026-11-06"
}
```

## Description

Ticket S4 of the AR0480 plan, which the owner approved with every recommendation on 2026-11-06 (AR-D523): a stats plugin that shows the tokens, cost and time of every job and of the coordinator, per role, ticket and project. The owner reads this branch as a GitHub pull request before it is merged (AR-D518, AR-D519).

## Goal

Entry 110: a pure move; `arthur stats` prints exactly what it prints today; audit and retro keep their `### Stats` section or say plainly that the plugin is not loaded, as `spec/features/AR0480-plan-a-stats-plugin-token-use-cost-and-time-of-every-job-and-of-the-coordinator/plan.md` lays it out (section 7 item for S4).

- Kind: refactor

## Done means

- Every point of S4 in the plan's Approach and Files works, each shown by a test that fails when it is removed; the plan's "How to test" lines for S4 hold.
- The docs of every command, option and host member it adds or changes say what it does.
- `npm run check` and `npm test` pass; each line budget raised names its new number in the final message.

## Scope

In:
- `packages/stats/`, `packages/manage/` and the docs the plan's Files name for 110.

Out:
- The other tickets of the AR0480 plan: their own tickets.
- The activity log (AR0527), budgets, `arthur usage`.

## Decisions

