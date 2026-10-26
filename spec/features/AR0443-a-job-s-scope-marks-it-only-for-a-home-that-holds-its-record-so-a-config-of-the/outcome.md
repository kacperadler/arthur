# AR0443 - Outcome

- Merged: 2026-10-26, `319637bf`
- Branch: arthur/2026-10-26-worker-1bf07670
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS, review-4.md PASS
- Cost: worker $8.03, reviews n/a; review rounds 4

## What went in

- `packages/core/src/job-sandbox.ts`, `wrapper.ts`: a job's Landlock sandbox also handles file reads when a path is hidden: it grants read on every entry from `/` down to the env file's real path except the next part of that path, so the env file (by path, through a symlink or a hard link) gives `Permission denied` to every process of the job; writes are as before. The start check skips the walk; the log line adds `reads every file but <path>`.
- `packages/core/src/env.ts`, `host.ts`, `cli.ts`: inside a job the CLI reads no env file; a plugin whose variable is not in the shell is not loaded (nor one requiring it), with one stderr line naming them. Here: github and telegram.
- Docs: `spawn.md` (The sandbox), `config.md`, `help.md`, github's `ci.md`, `docs/deploy.md` (threat model).
- Tests: `sandbox.test.ts` end to end (own config and home, ARTHUR_JOB cleared: EACCES, no token; a control outside the sandbox reads it), `host.test.ts` (the in-job load); `job-control.test.ts` waits for the agent's start; `limits.test.ts` time limits with room for the sandbox start. Core line budget 6269 (AR-D79, AR-D81 by policy).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1168/1174 passed.

## Left open

- F1: dropped (see findings.md); AR0453 dropped.
