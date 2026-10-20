# AR0236 - Outcome

- Merged: 2026-10-20, `c5ecd88`
- Branch: h/2026-10-20-ar0236-roadmap-57-github-6bafb88c
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $7.54, reviews $1.47; review rounds 2

## What went in

- `packages/github/` (new plugin): `instances` (`tokenEnv`, optional `apiUrl`) and `poll.everySeconds`; every poll reads the CI runs of the branches in play for each project's `ci.workflow`, takes the run of the nearest first-parent commit that has one, and emits `ci-finished` once per run id, kept across a restart in `.arthur/github/state.json`; a 401/403/404 is said once, a rate limit waits as GitHub says; the token and the remote URL never reach a log or an event. The instance is the one named after the repository's owner, else the unnamed one.
- README, `arthur.mmd`, the option-tables and structure tests (github 310), `package-lock.json`.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 822/822 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0238 (F1).
