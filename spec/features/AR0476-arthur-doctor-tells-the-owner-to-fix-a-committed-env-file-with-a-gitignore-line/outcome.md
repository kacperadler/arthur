# AR0476 - Outcome

- Merged: 2026-10-27, `ed92ed7d`
- Branch: arthur/2026-10-27-worker-de4b849f
- Reviews: review-1.md PASS
- Cost: worker $1.71, reviews $0.48; review rounds 1

## What went in

- `packages/core/src/requirements.ts`: the `core env ignored` check asks Git whether it tracks the env file; a tracked file gets its own `missing:` line (no `.gitignore` line can ignore it, and every commit keeps its values) and the fix `git -C <folder> rm --cached -- <name>`, commit, and rotate every value it held; an untracked file keeps the `.gitignore` fix.
- `packages/core/test/doctor.test.ts`: covers the tracked file, its fix leading to `ok`, and the untracked case again.
- `packages/core/docs/commands/doctor.md`: the tracked case, its text and fix.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1156/1223 passed.

## Left open

- Tickets from findings: AR0531 (F3).
