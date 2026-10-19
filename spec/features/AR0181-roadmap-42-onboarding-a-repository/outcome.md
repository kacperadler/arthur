# AR0181 - Outcome

- Merged: 2026-10-19, `9239fdd`
- Branch: h/2026-10-19-ar0181-onboarding-f9194d6e
- Reviews: review-1.md PASS
- Cost: worker $9.05, reviews $0.61; review rounds 1

## What went in

- `arthur init <project>` (roadmap 42): writes the vision and criteria skeletons, `.nvmrc` and an empty board, only where nothing is there yet and never through a symlink; refuses a project not in the config and a repository that already has a board; commits nothing. `arthur doctor` names a project without a board, with the fix.
- The `onboarding` kind with its role: it reads the repository, drafts the vision and criteria, and its questions reach the owner at most 10 per onboarding across all its runs.
- `merge.check` refuses an onboarding branch that touches any other file; `arthur merge` (54) will call it (AR0183).

## Checks on main

- `npm run check`: passed.
- `npm test`: 600/600 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0183 (F1), AR0184 (F2), AR0185 (F3), AR0186 (F4).
