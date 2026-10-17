# AR0107 - Outcome

- Merged: 2026-10-17, `533b31d`
- Branch: h/2026-10-17-ar0107-setup-guide-8323a113
- Reviews: review-1.md PASS
- Cost: worker $2.84, reviews $0.84; review rounds 1

## What went in

- `docs/setup.md`: 14 steps from a fresh VPS to a running Arthur, each with its check; steps not built yet say so and what to do by hand.
- `docs/deploy.md`: install steps moved to setup.md; threat model, daily use and updating stay.
- `spec/roadmap.md`: new entries 93 (option tables) and 94 (`arthur setup`); 42, 51, 80 extended.
- `README.md`, `arthur.mmd`, `docs/commands/run.md`, `projects.md`: link setup.md; `arthur setup` shown as planned.
- GitHub CI on the branch: ci and site passed.

## Checks on main

- `npm run check`: passed.
- `npm test`: 358/358 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: F1, F2 dropped.
