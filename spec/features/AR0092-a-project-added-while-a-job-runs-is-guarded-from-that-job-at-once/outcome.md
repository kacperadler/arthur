# AR0092 - Outcome

- Merged: 2026-10-17, `ecaf58f`
- Branch: h/2026-10-17-ar0092-c3f72abb
- Reviews: review-1.md PASS
- Cost: worker $1.96, reviews $0.85; review rounds 1

## What went in

- `packages/projects/src/projects.ts`: each config load writes `<home>/projects/checkouts`, one `<name> <folder>` line per project, through a rename and only when it changed.
- `packages/core/src/job-place.ts` (new, moved from `worktree-guard.ts`): `jobPlace` and `declaredPlace`, which reads that file on every call and falls back to the job record's list.
- `packages/core/src/worktree-guard.ts`: calls `declaredPlace` on every tool call; the first fallback writes one line to the job's log.
- `spawn.md`, `projects.md`: the record key and the list file.

## Checks on main

- `npm run check`: passed.
- `npm test`: 342/342 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0095 (F1). AR0095 dropped (small residual window). F2 dropped.
