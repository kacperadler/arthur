# AR0480 - Plan: a stats plugin, token use, cost and time of every job and of the coordinator, per role, ticket and project

```json
{
  "id": "AR0480",
  "title": "Plan: a stats plugin, token use, cost and time of every job and of the coordinator, per role, ticket and project",
  "date": "2026-10-27"
}
```

## Description

The owner, 2026-10-27, via Telegram: "One of the features / plugin that i wanna add to arthur is stats plugin, this is to be able to display stats about token usage, costs, tasks etc., prepare a task for planning this feature and i mean this should measure all jobs like orchestrator, worker, tester etc and be able to show stats of them too".

Today `arthur stats` (manage plugin, roadmap entry 61, `packages/manage/src/stats.ts`) reads only merged tickets: review rounds, verdicts, a worker's cost from `outcome.md`, and days. It counts no tokens, no job of another kind (review, plan, audit, retro, onboarding), no failed or dropped job, and not the coordinator's own session, whose cost is never recorded. A review's cost shows `n/a` once it is pruned (AR0474).

## Goal

The owner sees what Arthur spends and on what: tokens (input, output, cache read and write), cost and time of every job of every kind and of the coordinator and each project agent, by role, ticket, project, model and day, so he can tell which work and which role costs most and whether it pays.

- Kind: feat
- Plan: yes

## Done means

- `plan.md` in this folder, with options and a recommendation for each:
  - Source: where each number comes from. A job's tokens and cost from omp's own session log or its usage events; the coordinator's and a project agent's session, which never end; what a job on another machine (roadmap 30) sends back; a model on a local provider (Ollama), which costs nothing but uses tokens.
  - Record: where it is kept so it survives `arthur prune` and a restart (a line per job and per coordinator turn or day in an append-only file under the plugin's own `.arthur/` folder), its fields, and how a job already pruned is counted (not at all, or from the board's ticket costs).
  - Plugin: a new `stats` plugin, or a grown `manage` (`arthur stats` moves or stays); its line budget; the core interface it needs (a `job-ended` event with usage, or a reading of the job's log).
  - Views: `arthur stats` with filters (`--since`, `--project`, `--role`, `--ticket`, `--model`), `/stats` on the channels, a line in the morning report, and what the web panel (AR0086) shows later; the totals and rankings each one prints.
  - The Claude usage windows (`arthur usage`, the models plugin) beside the costs: whether stats shows the share of a window each role used.
  - Where it lands in the roadmap: new entries, their numbers and dependencies.
- No code; `npm test` and `npm run check` pass.

## Scope

In:
- `plan.md` only.

Out:
- The roadmap and vision edits, and the building: follow-up tickets after the owner picks.
- AR0474 (a review pruned before the merge makes the ticket cost unknown) stays its own fix.

## Decisions

- 2026-10-27: The owner asked for a stats plugin that measures every job (coordinator, worker, reviewer and the rest) for tokens, costs and tasks; the coordinator prepares a plan ticket, left at planning for his approval.
