# AR0241 - Outcome

- Merged: 2026-10-21, `5d9c3fe`
- Branch: h/2026-10-21-ar0241-merge-uses-projec-343c716f
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $3.18, reviews $1.15; review rounds 2

## What went in

- The projects plugin provides `projects.install` (`{ project, commit }` to the install a worktree gets, `""` for none); `arthur merge` asks it for main after the merge and runs it on every merge where the project has one, dropping its own lockfile table. A throw fails the install step and resets main; after a reset main is reinstalled only when an install ran. Recorded in `docs/plugin-api.md`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 864/864 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
