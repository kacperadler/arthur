# AR0094 - Outcome

- Merged: 2026-10-17, `3a3f14a`
- Branch: h/2026-10-17-ar0094-0dce1631
- Reviews: review-1.md PASS
- Cost: worker $6.89, reviews $0.91; review rounds 1

## What went in

- `packages/orchestration/` (new): the orchestration plugin; its six options checked at load; the coordinator as one interactive agent in its own tmux session with the env guard, started again after `restartDelaySeconds`, a start waiting up to `exitWaitSeconds` for the previous agent (known by pid and start time); `arthur attach`; `arthur coordinator stop`, refused while a job runs; the coordinator's role file.
- `packages/core/src/jobs.ts`, `job-records.ts`, `host.ts`, `plugin.ts`: `host.jobs.running()`, the ids of running jobs, for a plugin.
- `packages/core/src/fake-agent.ts`, `testing.ts`: the fake agent and fake host the coordinator's tests run on.
- `README.md`, `docs/deploy.md`, `arthur.config.example.ts`, `attach.md`, `coordinator.md`: status, deploy and the example config.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 353/353 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- F1: folded into roadmap entry 25 (AR0096 dropped). F2: folded into AR0080 (AR0097 dropped).
