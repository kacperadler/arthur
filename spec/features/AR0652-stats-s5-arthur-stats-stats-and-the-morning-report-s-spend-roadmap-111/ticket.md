# AR0652 - Stats S5: arthur stats, /stats and the morning report's Spend (roadmap 111)

```json
{
  "id": "AR0652",
  "title": "Stats S5: arthur stats, /stats and the morning report's Spend (roadmap 111)",
  "date": "2026-11-06"
}
```

## Description

Ticket S5 of the AR0480 plan, which the owner approved with every recommendation on 2026-11-06 (AR-D523): a stats plugin that shows the tokens, cost and time of every job and of the coordinator, per role, ticket and project. The owner reads this branch as a GitHub pull request before it is merged (AR-D518, AR-D519).

## Goal

Entry 111 and Approach section 4: bare `arthur stats` becomes the spend view with its filters, the report moves under `arthur stats tickets`, `/stats` answered without the model, the morning report's Spend section, as `spec/features/AR0480-plan-a-stats-plugin-token-use-cost-and-time-of-every-job-and-of-the-coordinator/plan.md` lays it out (section 7 item for S5).

- Kind: feat

## Done means

- Every point of S5 in the plan's Approach and Files works, each shown by a test that fails when it is removed; the plan's "How to test" lines for S5 hold.
- The docs of every command, option and host member it adds or changes say what it does.
- `npm run check` and `npm test` pass; each line budget raised names its new number in the final message.

## Scope

In:
- `packages/stats/` and the orchestration procedure and eval the plan names for 111.

Out:
- The other tickets of the AR0480 plan: their own tickets.
- The activity log (AR0527), budgets, `arthur usage`.

## Decisions

