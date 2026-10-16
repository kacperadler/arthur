# AR0019 - Outcome

- Merged: 2026-10-16, `8d28e21`
- Branch: h/2026-10-16-ar0019-job-state-008a35fb
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $10.68, reviews $1.71; review rounds 2

## What went in

- `job-state.ts` (new): four fixed states (working, idle, blocked, ended) with `reason` and `since`, written under one lock with `state` last; each change emits `job-state` (from, to, reason); `host.jobs.block` and `unblock`.
- Wrapper: output keeps a job `working`, `idleMinutes` (default 10, 0 off) of silence makes it `idle`; a final message starting `Blocked: user` or `Blocked: on <id>` ends the run `blocked`; ended reasons `finished`, `stopped`, `limit: …`, `failed: …`.
- Every reader of the old states (jobs, prune, stopall, continue, board, docs, roles) migrated. Core 4189 -> 4317 (128 of 250).

## Checks on main

- `npm run check`: passed.
- `npm test`: 287/287 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
