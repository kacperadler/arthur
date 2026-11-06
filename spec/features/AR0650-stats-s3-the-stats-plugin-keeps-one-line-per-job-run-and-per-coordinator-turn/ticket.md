# AR0650 - Stats S3: the stats plugin keeps one line per job run and per coordinator turn (roadmap 109)

```json
{
  "id": "AR0650",
  "title": "Stats S3: the stats plugin keeps one line per job run and per coordinator turn (roadmap 109)",
  "date": "2026-11-06"
}
```

## Description

Ticket S3 of the AR0480 plan, which the owner approved with every recommendation on 2026-11-06 (AR-D523): a stats plugin that shows the tokens, cost and time of every job and of the coordinator, per role, ticket and project. The owner reads this branch as a GitHub pull request before it is merged (AR-D518, AR-D519).

## Goal

Entry 109: the new `stats` package created with `arthur plugin new`, its two append-only files in its own folder, the backfill of existing records, the coordinator extension; first line budget 200 (AR-D523), as `spec/features/AR0480-plan-a-stats-plugin-token-use-cost-and-time-of-every-job-and-of-the-coordinator/plan.md` lays it out (section 7 item for S3).

- Kind: feat

## Done means

- Every point of S3 in the plan's Approach and Files works, each shown by a test that fails when it is removed; the plan's "How to test" lines for S3 hold.
- The docs of every command, option and host member it adds or changes say what it does.
- `npm run check` and `npm test` pass; each line budget raised names its new number in the final message.

## Scope

In:
- `packages/stats/` and the root files the plan's Files name for 109.

Out:
- The other tickets of the AR0480 plan: their own tickets.
- The activity log (AR0527), budgets, `arthur usage`.

## Decisions

