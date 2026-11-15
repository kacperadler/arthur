# AR0708 - Outcome

- Merged: 2026-11-15, `c7ee8203`
- Branch: arthur/2026-11-15-worker-554bf228
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $14.08, reviews $3.01; review rounds 2

## What went in

- packages/session/src/sessions.ts: the session plugin's list of sessions (coordinator plus each project agent, each with its own folder), which session a phone command came from, where a session's notice goes, and how a session is named
- packages/session/src/restart-command.ts: `arthur restart` and `/restart`, moved out of restart.ts, acting on the session of the sending chat or of `--project`
- packages/session/src/restart.ts: per-session fresh start, restart settling and `Restarted.` notice; a project agent waits only for its own project's jobs and merges; only the coordinator's session asks the restart that ends `arthur run`
- packages/session/src/session.ts: reads the sessions at setup, gives each session's agent its own extensions folder, clears each folder at start, runs the ticks per session, one compaction at a time
- packages/session/src/start-notice.ts: probes and start notices for each session in turn on its role's model, and turn-failure notices to each session's chat
- packages/session/docs/session.md: new "Project agents" section; intro and extension paragraph updated
- packages/session/docs/commands/restart.md: `/restart` per chat, `arthur restart --project`, and how an agent's restart differs
- packages/session/test/sessions.test.ts: tests for folders, compactions in turn, fresh start per project, `/restart` routing, the restart guard, notices per chat, and the restart edge cases
- packages/session/test/session.test.ts: removes the old test that gave a project agent no extensions
- packages/session/test/session-setup.ts: `load` takes project agents; `coordinator` can start a project agent
- packages/session/test/restart-setup.ts: fake `orchestration.sessions` and per-session `coordinator.restart`, notices by place, `route` with a sender, a job by project, `end()` on an agent
- packages/orchestration/src/orchestration.ts: provides `orchestration.sessions`; `coordinator.restart` takes `project`; header comment mentions roadmap 88
- packages/orchestration/docs/commands/coordinator.md: step 6 and the project-agent line describe `coordinator.restart` with `project`, `orchestration.sessions`, and the session plugin's support for agents
- packages/orchestration/test/project-agents.test.ts: tests `orchestration.sessions`, `coordinator.restart` by project, and its refusals, including "none"
- packages/orchestration/test/coordinator.test.ts: new refusal message for `coordinator.restart`
- docs/plugin-api.md: new `orchestration.sessions` row; `coordinator.restart` row with `{ fresh, project }`
- test/structure.test.ts: budgets for orchestration (3225) and session (1049)
- README.md: project agents listed as built under orchestration and session; no longer under Planned or the later plugins
- arthur.mmd: the project agents node moved to the Coordinator group as built; roadmap 88 no longer named as planned
- spec/roadmap.md: entry 88 names its ticket, AR0708
- spec/features/AR0708-project-agents-t4-compaction-the-fresh-start-and-the-handoff-for-every-project/findings.md: F1, `arthur restart --project` of a project without an agent restarts the coordinator without saying why (open)

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1807/1878 passed.

## Left open

- Deferred (client summary): F1. arthur restart --project of a project without an agent restarts the coordinator without a word
- Deferred (client summary): F2. nothing tells a project agent to write `after-restart.md` in its own folder
