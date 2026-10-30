# AR0585 - Before a job ends, the agent is reminded to close the processes it started that are no longer needed

```json
{
  "id": "AR0585",
  "title": "Before a job ends, the agent is reminded to close the processes it started that are no longer needed",
  "date": "2026-10-30"
}
```

## Description

The owner, 2026-10-30: "onSessionEnd hook should reminds agents to close any processes they started that aren't needed anymore - new task", "connected to clinup plugin". After this, when a job's agent is about to end its run, it is reminded to stop the processes it started (a dev server, a watcher, a test run in the background) that it no longer needs, and leftovers do not outlive the job.

## Goal

A job's agent can leave processes running when its run ends; they hold CPU, memory and ports that the next jobs need, and the cleanup today only removes worktrees, Docker resources and old folders.

Evidence:
- omp emits `agent_end` and `session_shutdown` to an extension (both names are in the omp 18.3.0 binary); Arthur's job extension `packages/delivery/src/checks-extension.ts` already listens to `tool_call` and `tool_result` the same way.
- The cleanup Arthur has: `packages/manage/src/cleanup.ts` (the daily prune of old jobs and temporary folders) and the cleanup after a merge (AR0555). Neither looks at processes a job left running. There is no plugin named `cleanup`; which home the owner means is the open question below.

- Kind: feat

## Done means

- At the end of a job's run (omp's `agent_end`, before the run's final message counts), the job's processes other than the agent and its wrapper are listed; when there are any, the agent gets one message naming each (pid, command) and asking it to stop those it no longer needs, then the run ends as today. At most once per run, so it never loops.
- With no such process, nothing is said and the run ends as today.
- A test with the fake agent: one leftover process gives the one reminder naming it; none gives none; a second end gives no second reminder.
- `npm run check` and `npm test` pass.

## Scope

In:
- A job extension beside `packages/delivery/src/checks-extension.ts`, or in the plugin the owner names; its doc page; its tests.

Out:
- Killing processes by force: the job's own scope still ends them when the job ends.
- The coordinator's own session.

## Open question

Where it lives: the owner said "connected to the cleanup plugin", and no plugin has that name. The candidates: the `manage` plugin beside its daily cleanup, the `delivery` plugin beside its job extension, or a new `cleanup` plugin.

## Decisions
