# AR0722 - Outcome

- Merged: 2026-11-18, `b6c1acfd`
- Branch: arthur/2026-11-18-worker-e6dc9838
- Reviews: review-1.md PASS
- Cost: worker $5.09, reviews $0.69; review rounds 1

## What went in

- packages/core/test/cli.test.ts: its 5 CLI envs carry `NODE_COMPILE_CACHE`
- packages/core/test/config-check.test.ts: its 4 CLI envs carry `NODE_COMPILE_CACHE`
- packages/core/test/doctor.test.ts: `project()`'s env carries `NODE_COMPILE_CACHE`; `start()` takes a `NodeJS.ProcessEnv`
- packages/core/test/job-control.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/core/test/job-records.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/core/test/model.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/core/test/roles.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/core/test/run.test.ts: `ENV` and its 2 inline CLI envs carry `NODE_COMPILE_CACHE`
- packages/core/test/sandbox.test.ts: the bare CLI env of the env-file test carries `NODE_COMPILE_CACHE`
- packages/core/test/secret-names.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/core/test/setup.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/core/test/spawn.test.ts: its 3 CLI envs carry `NODE_COMPILE_CACHE`
- packages/core/test/umask.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/docker/test/docker-options.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/docker/test/sweep.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/findings/test/findings-command.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/orchestration/test/board-commands.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/orchestration/test/context.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/orchestration/test/decisions.test.ts: its 3 CLI envs carry `NODE_COMPILE_CACHE`
- packages/orchestration/test/project-agents.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- packages/session/test/session.test.ts: the env of its `arthur run` carries `NODE_COMPILE_CACHE`
- spec/features/AR0722-tests-that-start-the-cli-or-a-fake-with-an-environment-of-their-own-miss-the/findings.md: new, F1: no check keeps a new test's env carrying the compile cache
- test/job-gate.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- test/job-home.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- test/piece-order.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- test/readme.test.ts: its CLI env carries `NODE_COMPILE_CACHE`
- test/report-check.test.ts: the bare env of its no-browser page check carries `NODE_COMPILE_CACHE`

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1839/1910 passed.

## Left open

- Deferred (client summary): F1. Nothing fails when a new test hands a Node child an env without `NODE_COMPILE_CACHE`
- Deferred (client summary): F2. With `NODE_DISABLE_COMPILE_CACHE` set, the 39 bare-env children still use the cache
