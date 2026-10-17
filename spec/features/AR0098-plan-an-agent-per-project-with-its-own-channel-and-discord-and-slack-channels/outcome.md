# AR0098 - Outcome

- Merged: 2026-10-18, `5cbfc1c`
- Branch: h/2026-10-17-ar0098-project-agents-160d388f
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $3.04, reviews $1.27; review rounds 2

## What went in

- `spec/vision.md`: option B: the main chat and each project's own chat; `roles.project`; `discord`, `slack` and `findings` rows; later-plugin order signal, discord, slack, whatsapp, server.
- `spec/roadmap.md`: entries 85 to 88 (project agents) and 89 to 92 (Discord, Slack); 47 to 50 carry `place`; the later order follows the plan's recommendation (not an owner decision).
- `arthur.config.example.ts`, diagrams: a project `chat`, Discord and Slack options.
- GitHub CI on the branch: ci and site passed.

## Checks on main

- `npm run check`: passed.
- `npm test`: 385/385 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0115 (F1); F2, F3 dropped.
