# AR0705 - Outcome

- Merged: 2026-11-14, `da1ed4ed`
- Branch: arthur/2026-11-13-worker-fa1b7778
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $29.10, reviews $5.39; review rounds 3

## What went in

- packages/core/src/cli.ts: a non-empty `ARTHUR_PROJECT` is the default of `--project`; `--project` wins over it
- packages/core/test/cli.test.ts: the env default, `--project` winning, an empty value, an unknown project
- packages/core/docs/commands/help.md: documents the `ARTHUR_PROJECT` default
- packages/core/docs/commands/roles.md: names the `project` role as one with a personality
- packages/orchestration/src/sessions.ts: new; the list of sessions, the piece check, the refusal of a chat two projects share, `sessionOf`, the one-at-a-time start chain
- packages/orchestration/src/coordinator.ts: `supervise` runs a project agent with its own context command, `--session-dir`, variables, labels and folder; starts go through the shared chain; an extension that answers nothing is skipped silently
- packages/orchestration/src/coordinator-commands.ts: new; `attach [<project>]` and `coordinator stop|context [<project>]`, moved out of orchestration.ts
- packages/orchestration/src/orchestration.ts: the piece and its helper, `after: projects`, the `project` role, `orchestration.chats`, the critical doctor line for a chat's plugin, one supervisor per session
- packages/orchestration/src/context.ts: `projectContext` (role, warnings, time); the time part is shared with the coordinator's context
- packages/orchestration/src/actor.ts: answers `agent:<project>` in an agent's session
- packages/orchestration/src/spawn-rules.ts: refuses a spawn or continue of another project's job from an agent's session
- packages/orchestration/src/orchestration-options.ts: `roles.project.model` must be one model name
- packages/orchestration/roles/project.md: new; the project agent's role
- packages/orchestration/docs/commands/coordinator.md: new "Project agents" section; usage, stop, options and MCP updated
- packages/orchestration/docs/commands/attach.md: `[<project>]` and its refusals
- packages/orchestration/docs/orchestration.md: project agents and the `roles.project` rule
- packages/orchestration/test/project-agents.test.ts: new; project agent behaviour on the fake tmux, plus a real CLI load
- packages/orchestration/test/fake-tmux.ts: new; a fake tmux and `omp` for hosts without Unix sockets
- packages/orchestration/test/coordinator.test.ts: new usage and refusal lines; an undefined extension answer is skipped
- packages/orchestration/test/actor.test.ts: `agent:<project>`, and an unknown agent folder
- packages/session/src/session.ts: answers `coordinator.extension` only for the coordinator's session
- packages/session/test/session.test.ts: no session extensions for an agent's session
- packages/session/test/session-setup.ts: asks for the coordinator's session's extensions
- packages/session/test/restart-setup.ts: asks for the coordinator's session's extensions
- packages/session/test/start-notice.test.ts: asks for the coordinator's session's extensions
- packages/session/docs/session.md: an agent's session gets no session extensions until roadmap 88
- packages/stats/src/session-extension.ts: names the session from `ARTHUR_ORCHESTRATION_SESSION`, else `coordinator`
- packages/stats/test/stats.test.ts: `sessions/agent:shop.jsonl`; an empty name falls back to `coordinator`
- packages/stats/docs/stats.md: one file per session
- packages/telegram/src/telegram.ts: one doctor line per bot a project's chat names: ok only when `getMe.has_topics_enabled` is true, else "is not true"
- packages/telegram/test/telegram.test.ts: topics on, off, left out of getMe, getMe failing, an unknown bot, no chat
- packages/telegram/test/fake-bot-api.ts: the second fake bot has topics on; `omit` leaves an Optional getMe field out
- packages/telegram/docs/telegram.md: new "Project chats" section
- docs/plugin-api.md: `orchestration.chats`, `coordinator.extension` asked with `{ session }`, the actor `agent:<project>`, the new `doctor` and `channel.send` uses
- README.md: orchestration partly built with project agents; its small diagram lists project agents as partly built in the later plugins node
- arthur.mmd: project agents stay in Later plugins, marked partly built (1 of 4 entries); line 4 plans only roadmap 86 to 88
- arthur.config.example.ts: the project agent comment
- spec/roadmap.md: entry 85's role file, working folder, session folder, doctor line and stats variable
- test/outside-text.test.ts: `project.md` is treated like `coordinator.md`
- test/structure.test.ts: line budgets orchestration 3070, session 961, telegram 702
- spec/features/AR0705-project-agents-t1-each-project-with-a-chat-gets-its-own-supervised-omp-session/findings.md: new; F1 to F5

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1777/1848 passed.

## Left open

- Deferred (client summary): F1. No test runs a project agent on a real tmux server where Unix sockets are refused
- Deferred (client summary): F2. Two projects can share one place when one names the main bot and the other leaves instance out
- Deferred (client summary): F3. One SIGTERM and SIGINT listener per supervised session
- Deferred (client summary): F4. The vision still says an agent per project comes later
- Deferred (client summary): F5. npm run mutate leaves a test job's wrapper and fake agent running
- Deferred (client summary): F6. the role says the agent's reply is sent when its turn ends
