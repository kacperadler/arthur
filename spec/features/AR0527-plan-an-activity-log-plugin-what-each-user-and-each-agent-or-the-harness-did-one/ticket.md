# AR0527 - Plan: an activity log plugin, what each user and each agent or the harness did, one file per day

```json
{
  "id": "AR0527",
  "title": "Plan: an activity log plugin, what each user and each agent or the harness did, one file per day",
  "date": "2026-10-27"
}
```

## Description

The owner, 2026-10-27, via Telegram: "i think we will need another plugin for logs, what user done and what agent / harness done, when we will have multiple users thisl will be good and the logs should be stored by day, i mean one file for one day, can you create the task for it and plan?"

Today what happened is spread over several places, none of them a log of who did what: the core's event log `<home>/events.jsonl` (`packages/core/src/event-log.ts`: one file that only grows, events of jobs and tickets, no actor), each job's own record and log (gone after `arthur prune`), the decision log `spec/decisions.jsonl` (the owner's answers, written by the coordinator: AR0482, AR0502), the channels' messages (not kept), and git history. Nothing says which user wrote what, or which agent or command acted on his word, and nothing is cut by day.

## Goal

One activity log, a plain file per day, that answers "who did what, and on whose word": every user's message and command (from which channel), and every action of the coordinator, a project agent, a job and the harness itself (spawn, steer, stop, continue, merge, a ticket moved, a decision asked or answered, a schedule entry fired, a restart), each line naming its actor. It must be ready for several users (the company edition, AR0131), and it never holds a secret's value (AR0518 names them).

- Kind: feat
- Plan: yes

## Done means

- `plan.md` in this folder, with options and a recommendation for each:
  - Actors: how a line names a user (channel and user id, the terminal), the coordinator, a project agent, a job (its id, kind, ticket), a plugin, and Arthur itself; what ties an agent's action to the user message it acted on, and what that gives AR0502.
  - What is logged: the list of events and messages, what the core already emits (`events.jsonl`) and what is missing (a user's message, a command run from the shell or a channel, the coordinator's own commands); whether message text is kept whole, cut, or only referenced, and how secret values and other people's forwarded words are handled.
  - Files: one file per day in `core.timeZone` (name, format such as JSON lines, where under the plugin's own `.arthur/` folder), writing without half lines from several processes, retention and size, and whether it is ever committed to git (it holds the owner's words: the vision says no client names reach GitHub).
  - Plugin: a new plugin or part of an existing one (the core's event log, `manage`, the stats plan AR0480), its line budget, and the host interface it needs (an event for an incoming message, an actor on every event).
  - Views: `arthur log` with filters (`--day`, `--user`, `--actor`, `--ticket`, `--job`), a `/log` phone command, and what the web panel (AR0086) shows later.
  - Several users: what changes when there is more than one (who may read whose lines, per-project agents of roadmap 85 to 88).
  - Where it lands in the roadmap: new entries, their numbers and dependencies.
- No code; `npm test` and `npm run check` pass.

## Scope

In:
- `plan.md` only.

Out:
- The roadmap and vision edits, and the building: follow-up tickets after the owner picks.
- The stats plugin: AR0480, which this plan names where the two meet.

## Decisions
- 2026-10-27: AR0527 approved: a planner writes plan.md for an activity log plugin, one file per day, users and agents; the owner: "can you create the task for it and plan?" (AR-D200)
- 2026-10-27: Plan approved by the owner: plan.md at ddbaf77e; not built today; the owner: "AR-D203 1 - but do not build this today" (AR-D203)

