# AR0410 - Outcome

- Merged: 2026-10-25, `8cd738c7`
- Branch: arthur/2026-10-25-worker-ade85e49
- Reviews: none
- Cost: worker $0.39, reviews $0.00; review rounds 0

## What went in

- `docs/setup.md`, step 5's `projects` line: `ci.workflow` needs the checkout's `origin` remote on GitHub (`git@github.com:<owner>/<repository>.git` or `https://github.com/<owner>/<repository>`), and the github plugin refuses at setup a project with `ci.workflow` and no such `origin` (`packages/github/docs/github.md`).
- No review: docs only (`arthur review-needed`); merged on the owner's standing AR-D11.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1105/1105 passed.

## Left open

- Findings: none; no findings.md on this ticket.
