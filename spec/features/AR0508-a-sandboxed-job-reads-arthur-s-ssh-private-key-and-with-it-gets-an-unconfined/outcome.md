# AR0508 - Outcome

- Merged: 2026-10-27, `ff9650e5`
- Branch: arthur/2026-10-27-worker-6355f513
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $4.67, reviews $1.74; review rounds 2

## What went in

- `packages/core/src/job-sandbox.ts`: `hidden()` and `stepSandbox` hide the home's `.ssh` (from `homedir()`, not the record) beside the env file, from a job's agent, its install and `arthur merge`'s checks; the read-granting walk skips every folder at or below a hidden path, so a hidden file inside a hidden folder unhides nothing of it.
- `packages/core/test/sandbox.test.ts`: a fake key is refused to the install and the agent, again after `continue` with `guarded` emptied, and to a merge step, while it reads outside the sandbox; a hidden path directly in, or deeper in, a hidden folder unhides neither key.
- `packages/core/docs/commands/spawn.md`, `docs/deploy.md`, `docs/plugin-api.md`, `packages/core/src/plugin.ts`, `packages/delivery/docs/commands/merge.md`: say `~/.ssh` is hidden from jobs and merge steps, and which credentials outside it a job can still read.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1141/1208 passed.

## Left open

- Tickets from findings: AR0512 (F1), AR0513 (F2), AR0514 (F3), AR0515 (F4).
