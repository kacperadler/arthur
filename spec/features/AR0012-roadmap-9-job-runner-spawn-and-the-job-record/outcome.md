# AR0012 - Outcome

- Merged: 2026-10-16, `30a43af`
- Branch: h/2026-10-16-ar0012-job-runner-spawn-b046ca2a
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $4.64, reviews $1.41; review rounds 2

## What went in

- `packages/core/src/jobs.ts`: `arthur spawn` and `host.jobs` (`registerKind`, `beforeSpawn`, `prepare`, `spawn`): a worker gets `arthur/<id>` and a worktree in `.arthur-worktrees/<id>` beside the repository, a read-only kind a detached checkout; every refusal before anything is created; the record in `<home>/jobs/<id>/` written whole; a throwing `prepare` removes what was made; `job-started` last.
- `git.ts`: the Git commands it uses; `node_modules` copied on an identical lock file.

## Checks on main

- `npm run check`: passed.
- `npm test`: 153/153 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0042 (F1).
