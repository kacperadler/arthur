# AR0706 - Outcome

- Merged: 2026-11-15, `046a2fee`
- Branch: arthur/2026-11-14-worker-8a88fde0
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md FAIL, review-4.md PASS
- Cost: worker $44.81, reviews $5.52; review rounds 4

## What went in

- `packages/orchestration/test/project-routing.test.ts`: as before, and the removed-agent test now covers a reply in `outbox/held/`: the turn message it answers stays, and the held reply stays where it is.
- README.md: not described
- arthur.config.example.ts: not described
- arthur.mmd: not described
- docs/plugin-api.md: not described
- packages/delivery/docs/commands/merge.md: not described
- packages/delivery/src/ci-wait.ts: not described
- packages/delivery/src/hand-back.ts: not described
- packages/delivery/src/merge-recovery.ts: not described
- packages/delivery/src/pass-forward.ts: not described
- packages/delivery/test/auto-merge.test.ts: not described
- packages/delivery/test/hand-back.test.ts: not described
- packages/delivery/test/pass-forward.test.ts: not described
- packages/delivery/test/review-setup.ts: not described
- packages/discord/docs/discord.md: not described
- packages/discord/src/discord.ts: not described
- packages/discord/test/discord.test.ts: not described
- packages/github/docs/github.md: not described
- packages/github/src/github.ts: not described
- packages/github/test/github.test.ts: not described
- packages/orchestration/docs/commands/agent.md: not described
- packages/orchestration/docs/commands/coordinator.md: not described
- packages/orchestration/docs/commands/decision.md: not described
- packages/orchestration/docs/orchestration.md: not described
- packages/orchestration/roles/coordinator.md: not described
- packages/orchestration/roles/project.md: not described
- packages/orchestration/src/agent-command.ts: not described
- packages/orchestration/src/autopilot.ts: not described
- packages/orchestration/src/blocked-notice.ts: not described
- packages/orchestration/src/decision-commands.ts: not described
- packages/orchestration/src/decision-hooks.ts: not described
- packages/orchestration/src/decision-use.ts: not described
- packages/orchestration/src/decision-writes.ts: not described
- packages/orchestration/src/hand-over.ts: not described
- packages/orchestration/src/inbox.ts: not described
- packages/orchestration/src/orchestration.ts: not described
- packages/orchestration/src/sessions.ts: not described
- packages/orchestration/src/voice-reply.ts: not described
- packages/orchestration/src/wake.ts: not described
- packages/orchestration/test/decisions.test.ts: not described
- packages/orchestration/test/hand-over.test.ts: not described
- packages/orchestration/test/inbox-start.test.ts: not described
- packages/orchestration/test/inbox.test.ts: not described
- packages/orchestration/test/job-states.test.ts: not described
- packages/orchestration/test/project-agents.test.ts: not described
- packages/orchestration/test/voice-reply.test.ts: not described
- packages/telegram/docs/telegram.md: not described
- packages/telegram/src/telegram.ts: not described
- packages/telegram/test/telegram.test.ts: not described
- packages/uptime/docs/uptime.md: not described
- packages/uptime/src/uptime.ts: not described
- packages/uptime/test/uptime.test.ts: not described
- spec/features/AR0706-project-agents-t2-a-project-chat-s-messages-and-its-jobs-ends-go-to-its-agent/findings.md: not described
- spec/roadmap.md: not described
- test/structure.test.ts: not described

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1794/1865 passed.

## Left open

- Deferred (client summary): F1. A project agent's voice note goes by the main bot, not its chat's bot
- Deferred (client summary): F2. The activity log does not show `agent-told`
- Deferred (client summary): F3. Uptime's down and up notices go to every channel's main place, not the project agent's chat
