# AR0653 - Stats S6: Claude usage windows beside the costs, an estimate marked ≈ (roadmap 112)

```json
{
  "id": "AR0653",
  "title": "Stats S6: Claude usage windows beside the costs, an estimate marked ≈ (roadmap 112)",
  "date": "2026-11-06"
}
```

## Description

Ticket S6 of the AR0480 plan, which the owner approved with every recommendation on 2026-11-06 (AR-D523): a stats plugin that shows the tokens, cost and time of every job and of the coordinator, per role, ticket and project. The owner reads this branch as a GitHub pull request before it is merged (AR-D518, AR-D519).

## Goal

Entry 112 and Approach section 5 (Not available directly, Option 2, AR-D523): `arthur stats windows`, the `models.windows` provide with `durationMs`, each role's share marked `≈` and as an upper bound, as `spec/features/AR0480-plan-a-stats-plugin-token-use-cost-and-time-of-every-job-and-of-the-coordinator/plan.md` lays it out (section 7 item for S6).

- Kind: feat

## Done means

- Every point of S6 in the plan's Approach and Files works, each shown by a test that fails when it is removed; the plan's "How to test" lines for S6 hold.
- The docs of every command, option and host member it adds or changes say what it does.
- `npm run check` and `npm test` pass; each line budget raised names its new number in the final message.

## Scope

In:
- `packages/stats/` and `packages/models/` files the plan's Files name for 112.

Out:
- The other tickets of the AR0480 plan: their own tickets.
- The activity log (AR0527), budgets, `arthur usage`.

## Decisions

