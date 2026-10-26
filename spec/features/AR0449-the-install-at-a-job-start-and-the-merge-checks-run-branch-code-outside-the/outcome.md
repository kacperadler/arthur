# AR0449 - Outcome

- Merged: 2026-10-26, `bb0f1aef`
- Branch: arthur/2026-10-26-worker-bed8b28b
- Reviews: review-1.md PASS
- Cost: worker $6.39, reviews n/a; review rounds 1

## What went in

- `packages/core/src/job-sandbox.ts`: `sandboxed(paths, hidden, agent, note, who)` probes once and returns a builder; `caches()` lists the package caches an install writes (npm, bun, pnpm, uv, composer; a missing one is skipped); `stepSandbox(folder, envFile, note)` for merge steps.
- `packages/core/src/wrapper.ts`, `job-install.ts`: a job's install runs by `sh -c` in the sandbox (the job's own paths and the caches writable, the env file hidden), with a `sandbox:` or `no sandbox: <why>` log line.
- `packages/core/src/plugin.ts`, `plugin-host.ts`, `host.ts`, `testing.ts`: new host member `host.sandbox(folder, note)`; the host takes the env file path.
- `packages/delivery/src/merge-checks.ts`, `merge-command.ts`: each check step on main runs in that sandbox, inside its scope or bare; one `no sandbox:` line only when it cannot be set up.
- Docs: `spawn.md`, `merge.md`, `projects.md`, `docs/deploy.md`, `docs/plugin-api.md`.
- Tests: `sandbox.test.ts` (install hides the env file), new `merge-checks.test.ts`, `install.test.ts` takes the sandbox line. Core line budget 6296 (AR-D84 by policy).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1171/1177 passed.

## Left open

- Tickets from findings: AR0454 (F1), AR0455 (F2), AR0456 (F3), AR0457 (F4), AR0458 (F5).
