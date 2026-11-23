# AR0715 - Outcome

- Merged: 2026-11-23, `74c6f841`
- Branch: arthur/2026-11-23-worker-4ce32038
- Reviews: review-1.md PASS
- Cost: worker $6.49, reviews $0.48; review rounds 1

## What went in

- packages/orchestration/src/orchestration.ts: the critical doctor line `chat of <project>` is missing when the routing gives that chat's messages to an earlier project's agent, naming both projects, the chat and the main bot, with its own fix; this reason comes before the missing `channel.send` one.
- packages/orchestration/src/sessions.ts: exports `mainBots(host)`, each channel's main bot by name from `channel.main`; the load check's comment says it compares the names as written and that `arthur doctor` asks which bot is main.
- packages/orchestration/src/inbox.ts: routes with `mainBots` from sessions.ts instead of its own copy.
- packages/orchestration/test/project-agents.test.ts: one test per order of the shared chat; the first project named with others between, and the shared reason before a missing `channel.send`; pairs on different places, bots or channels and an unnamed main bot stay `ok`; shared doctor helpers.
- packages/orchestration/docs/commands/coordinator.md: "Project agents" describes the new `missing:` reason of the `chat of <project>` line, and that the load compares the names as written.
- docs/plugin-api.md: `channel.main` is also asked by orchestration's doctor line.
- spec/roadmap.md: entry 85's Done means names the doctor refusal of a chat shared through the main bot (AR0715).
- test/structure.test.ts: the orchestration line budget is 3242, up from 3225.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1849/1920 passed.

## Left open

- Findings: none; no findings.md on this ticket.
