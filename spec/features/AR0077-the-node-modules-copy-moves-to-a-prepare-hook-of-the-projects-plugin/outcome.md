# AR0077 - Outcome

- Merged: 2026-10-16, `3d31a1c`
- Branch: h/2026-10-16-ar0077-ar0077-the-node-m-d8a03f3a
- Reviews: review-1.md PASS
- Cost: worker $0.77, reviews $0.50; review rounds 1

## What went in

- `node-modules.ts` gone from the core (4339 -> 4322 lines); entry 41 gives the copy to a `prepare` hook of the `projects` plugin; until then a job installs from the lockfile; `spawn.md` and roadmap 9, 21, 41 and R2 say so.

## Checks on main

- `npm run check`: passed.
- `npm test`: 271/271 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
