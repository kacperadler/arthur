# AR0542 - The agent's bun, pnpm, uv and composer still have no writable cache

```json
{
  "id": "AR0542",
  "title": "The agent's bun, pnpm, uv and composer still have no writable cache",
  "date": "2026-10-28"
}
```

## Description

F1 of AR0456 (spec/features/AR0456-the-agent-s-own-npm-ci-cannot-write-npm/findings.md).

- Kind: fix
- Found by: 2026-10-28-worker-0197a47f (worker), 2026-10-28
- Where: `packages/core/src/wrapper.ts:129`, `packages/core/src/job-sandbox.ts:106` (`cached`)
- What: the agent now gets the record's npm cache (`npm_config_cache`, AR0456), but not the other variables the install gets (`BUN_INSTALL_CACHE_DIR`, `XDG_CACHE_HOME`, `PNPM_HOME`, `COMPOSER_CACHE_DIR`); in a job's sandbox `~/.bun/install/cache`, `~/.cache`, `~/.local/share/pnpm` and `~/.composer/cache` are read-only, so an agent that installs with bun, pnpm, uv or composer itself fails as npm did [INFERENCE: from `writable`, which grants none of them; not run with those tools].
- Suggestion: give the agent the same variables as the install, from one function both use. Weigh `XDG_CACHE_HOME` first: it moves every XDG-aware tool's cache, omp's own included if it keeps one there, so each job would start with an empty one.

## Goal

A job's agent can install with bun, pnpm, uv or composer itself, as it now can with npm. Evidence: `packages/core/src/wrapper.ts:129` gives the agent only `npm_config_cache`, while the install (`cached`, `packages/core/src/job-sandbox.ts:106`) also sets the bun, pnpm, composer and XDG cache variables; in the sandbox `~/.bun/install/cache`, `~/.cache`, `~/.local/share/pnpm` and `~/.composer/cache` are read-only (F1 of AR0456).

- Kind: fix

## Done means

- The agent gets the same cache variables as the install, from one function both use (weighing `XDG_CACHE_HOME`, which also moves omp's own cache if it keeps one there); a sandbox test runs at least one of these tools offline as the agent and sees it write the record's cache, and fails without the change.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/wrapper.ts`, `packages/core/src/job-sandbox.ts`, `packages/core/test/sandbox.test.ts`.

Out:
- npm (AR0456, done).

## Decisions

- 2026-10-28: Source: F1 of AR0456
