# AR0456 - The agent's own `npm ci` cannot write `~/.npm`

```json
{
  "id": "AR0456",
  "title": "The agent's own `npm ci` cannot write `~/.npm`",
  "date": "2026-10-26"
}
```

## Description

F3 of AR0449 (spec/features/AR0449-the-install-at-a-job-start-and-the-merge-checks-run-branch-code-outside-the/findings.md).

- Kind: fix
- Found by: 2026-10-26-worker-bed8b28b (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts` (`writable`), `packages/core/roles/worker.md`
- What: in this job's sandbox `touch ~/.npm/_probe_x` gave `Permission denied`; the worker's role tells a job without an install to install from the lockfile itself, which then runs without a writable npm cache. What npm does then was not run.
- Suggestion: decide whether the agent gets the caches the install now gets (`caches()` added to `writable`), weighed against F1.

## Goal

An agent that installs from the lockfile itself, as the worker's role tells it to when no install ran, has a writable npm cache. Evidence: in a job's sandbox `touch ~/.npm/_probe_x` gave `Permission denied` (F3 of AR0449); the shared cache stays closed to the agent so a job cannot poison another job's install (F1 of AR0449).

- Kind: fix

## Done means

- The agent's npm runs with a cache of its own inside the job (`npm_config_cache` pointing at a job-private folder that is writable), never the shared `~/.npm`; a test shows `npm ci` in a job's sandbox writes there and the shared cache is untouched.
- `spawn.md` says where the agent's cache is.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/job-sandbox.ts` (or where the job's environment is set) and its test, `packages/core/docs/commands/spawn.md`.

Out:
- The shared caches the install and merge checks use: unchanged.
- A missing shared cache on a fresh host: AR0455.

## Decisions

- 2026-10-26: Source: F3 of AR0449
