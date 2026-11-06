# AR0648 - Stats S1: roadmap entries 108 to 112 and the vision's stats row, from the AR0480 plan

```json
{
  "id": "AR0648",
  "title": "Stats S1: roadmap entries 108 to 112 and the vision's stats row, from the AR0480 plan",
  "date": "2026-11-06"
}
```

## Description

Ticket S1 of the AR0480 plan, which the owner approved with every recommendation on 2026-11-06 (AR-D523): a stats plugin that shows the tokens, cost and time of every job and of the coordinator, per role, ticket and project. The owner reads this branch as a GitHub pull request before it is merged (AR-D518, AR-D519).

## Goal

Approach section 6 and section 7 item 1: entries 108 to 112 in a new `## Stats` section after `## Releases` and before `## Later`; the edits to entries 61, 77, 85 and the coverage row M2; the vision's plugin table gains a `stats` row and manage's row loses "stats". Docs only, as `spec/features/AR0480-plan-a-stats-plugin-token-use-cost-and-time-of-every-job-and-of-the-coordinator/plan.md` lays it out (section 7 item for S1).

- Kind: docs

## Done means

- Every point of S1 in the plan's Approach and Files works, each shown by a test that fails when it is removed; the plan's "How to test" lines for S1 hold.
- The docs of every command, option and host member it adds or changes say what it does.
- `npm run check` and `npm test` pass; each line budget raised names its new number in the final message.

## Scope

In:
- `spec/roadmap.md`, `spec/vision.md`.

Out:
- The other tickets of the AR0480 plan: their own tickets.
- The activity log (AR0527), budgets, `arthur usage`.

## Decisions

