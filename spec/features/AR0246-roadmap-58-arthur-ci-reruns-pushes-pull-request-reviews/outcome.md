# AR0246 - Outcome

- Merged: 2026-10-21, `1f039d3`
- Branch: h/2026-10-21-ar0246-roadmap-58-github-56fccda8
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $11.44, reviews $2.43; review rounds 2

## What went in

- `packages/github`: `arthur ci <branch> [--rerun]` names each failed job and step and shows the end of the first failed log (its last 30 lines up to the last error); `--rerun` reruns a failed or cancelled run once, refusing a passed, unfinished or already rerun run. `ci-finished` is told once per run attempt (AR0238). Pull request reviews are polled when `wakeOn` names them; `wakeOn` defaults to `["ci-finished"]`.
- New provided name `github.push`: delivery pushes the reviewed branch after a PASS and main after a merge, one warning line on failure, never a prompt. Recorded in `docs/plugin-api.md`.
- Docs, README, `arthur.mmd`, `test/structure.test.ts` (github 586, delivery 779).

## Checks on main

- `npm run check`: passed.
- `npm test`: 868/868 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0248 (F1), AR0249 (F2), AR0250 (F3).
