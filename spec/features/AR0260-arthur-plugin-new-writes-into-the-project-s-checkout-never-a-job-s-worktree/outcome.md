# AR0260 - Outcome

- Merged: 2026-10-21, `ee75ab0`
- Branch: h/2026-10-21-ar0260-plugin-new-in-a-w-1a01c2ba
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.82, reviews $1.03; review rounds 2

## What went in

- In a job, `arthur plugin new --root <the job's worktree>` writes the new package into that worktree, on the job's branch; no `--root`, another folder, or a missing one is refused before anything is written. Outside a job it writes into the project's checkout as before and refuses `--root`. Budget develop 209.

## Checks on main

- `npm run check`: passed.
- `npm test`: 949/949 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0274 (F1).
