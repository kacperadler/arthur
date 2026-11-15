# AR0707 - Outcome

- Merged: 2026-11-15, `d7b3b8ff`
- Branch: arthur/2026-11-15-worker-2bd2ef1b
- Reviews: review-1.md PASS
- Cost: worker $4.55, reviews $1.11; review rounds 1

## What went in

- README.md: orchestration's line names the agent's own-project context; only roadmap 88 is still planned.
- arthur.mmd: the project agents node holds its own project's context, 3 of 4 entries merged; the planned note names only 88.
- docs/plugin-api.md: `coordinator.context` lines also go, unchanged, into each project agent's context.
- packages/orchestration/docs/commands/coordinator.md: the end mark `down` (steps 2 and 5, the agent's folder), the coordinator's `## Project agents` lines, and the project agent's full context.
- packages/orchestration/docs/commands/decision.md: an agent's context lists its own project's open decisions only.
- packages/orchestration/docs/commands/silent.md: `## Silent` shows in each project agent's context too.
- packages/orchestration/roles/coordinator.md: its context names each project agent up or down since when.
- packages/orchestration/roles/project.md: its context holds its project's vision, board, jobs and decisions, and the slots of `maxAgents`.
- packages/orchestration/src/context.ts: `coordinatorContext(host, { project?, sessions?, checkout? })` builds the coordinator's, a project agent's or an eval copy's context; it reads each agent's up or down state from its pid file and end mark; `projectContext` is gone.
- packages/orchestration/src/coordinator-commands.ts: `coordinator context [<project>]` calls `coordinatorContext` with the project, or with the session list for the coordinator.
- packages/orchestration/src/coordinator.ts: the supervisor writes the end mark `down` when it sees an agent end and when its stop kills a running one, and removes it at a start; it exports `PID_FILE`, `DOWN` and `startTime`.
- packages/orchestration/src/decision-context.ts: `decisionContext(host, only?)` lists one project's open decisions when asked.
- packages/orchestration/src/orchestration.ts: `coordinator.checkoutContext` passes `{ checkout }`.
- packages/orchestration/test/context.test.ts: tests of the agent's full context (vision warning, its jobs and decisions only, slots across projects) and of the coordinator's up/down lines.
- packages/orchestration/test/project-agents.test.ts: the agent context test matches the new layout; the stop test checks the end marks and the up/down lines with the fake tmux.
- spec/roadmap.md: entry 87 names its ticket, AR0707.
- test/structure.test.ts: orchestration line budget 3219.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1796/1867 passed.

## Left open

- Deferred (client summary): F1. removing the condition that writes the end mark only when a session was running at stop goes uncaught
