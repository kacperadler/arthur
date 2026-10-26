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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-26: Source: F1 of AR0449
