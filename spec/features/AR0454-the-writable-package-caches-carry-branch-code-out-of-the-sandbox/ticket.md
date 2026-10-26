# AR0454 - The writable package caches carry branch code out of the sandbox

```json
{
  "id": "AR0454",
  "title": "The writable package caches carry branch code out of the sandbox",
  "date": "2026-10-26"
}
```

## Description

F1 of AR0449 (spec/features/AR0449-the-install-at-a-job-start-and-the-merge-checks-run-branch-code-outside-the/findings.md).

- Kind: security
- Found by: 2026-10-26-worker-bed8b28b (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts` (`caches`)
- What: the install and the merge's checks write `~/.npm`, `~/.bun/install/cache` and the pnpm, uv and composer caches, which every job and Arthur's user share. A lifecycle script can write there what a later process outside any sandbox reads or runs: an `npx <package>` the coordinator or the owner runs takes `~/.npm/_npx/<hash>/node_modules` as it finds it. Not reproduced; read from npm's cache layout [INFERENCE].
- Suggestion: give each job and each merge its own cache (`npm_config_cache`, `BUN_INSTALL_CACHE_DIR`, `XDG_CACHE_HOME` pointed into the worktree or a per-job folder), at the cost of a cold cache per job; or leave `_npx` out of the writable paths. Out: changing what the agent itself may write.

## Goal

Since AR0449 a job's install and each merge step run in the sandbox, but they may write the package caches every process of Arthur's user shares (`caches()` in `packages/core/src/job-sandbox.ts`): `~/.npm`, `~/.bun/install/cache`, pnpm's, uv's and composer's. Branch code can leave in them what a later process outside any sandbox runs, such as `~/.npm/_npx/<hash>/node_modules` for the next `npx <package>` the coordinator or the owner runs.

- Kind: security

## Done means

- The install and each merge step get a cache of their own instead of the shared ones: the package managers' cache variables (`npm_config_cache`, `BUN_INSTALL_CACHE_DIR`, `XDG_CACHE_HOME` for pnpm and uv, `COMPOSER_CACHE_DIR`) point into a folder of that job (beside its record) or of that merge (removed after it), and `caches()` no longer makes the shared folders writable. A cold cache per job is accepted.
- A test in `packages/core/test/sandbox.test.ts`: an install that writes `~/.npm/_npx/x` (the test's own HOME) gets `EACCES` and leaves nothing there, while `npm_config_cache` points into the job's folder and is writable. It fails before the change; skipped where the sandbox cannot be set up, as the other Landlock tests.
- `docs/commands/spawn.md` ("The sandbox") and `merge.md` say where the caches are. The checks pass.

## Scope

In:
- `packages/core/src/job-sandbox.ts`, `packages/core/src/wrapper.ts` (or `job-install.ts`): the cache variables and writable paths.
- `packages/core/test/sandbox.test.ts`, and the merge's tests if the step's environment changes there.
- `packages/core/docs/commands/spawn.md`, `packages/delivery/docs/commands/merge.md`.

Out:
- What the agent itself may write (AR0456).

## Decisions

- 2026-10-26: Source: F1 of AR0449
- 2026-10-26: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
- 2026-10-26: Raise the delivery line budget to 1442 for AR0454 (AR-D61); the owner: "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS" (AR-D106)
- 2026-10-26: Accept host.sandbox(folder, cache, note) for AR0454, recorded in docs/plugin-api.md (the coordinator's recommendation, under AR-D98); the owner: "always go with your recommendation" (AR-D107)
- 2026-10-27: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D74)
