# AR0455 - A package cache that does not exist yet stays closed, so a fresh host's first install in a job fails

```json
{
  "id": "AR0455",
  "title": "A package cache that does not exist yet stays closed, so a fresh host's first install in a job fails",
  "date": "2026-10-26"
}
```

## Description

F2 of AR0449 (spec/features/AR0449-the-install-at-a-job-start-and-the-merge-checks-run-branch-code-outside-the/findings.md).

- Kind: ux
- Found by: 2026-10-26-worker-bed8b28b (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts` (`caches`, the script's skip of a missing path)
- What: a writable path that is missing is skipped, so on a host where, say, `~/.npm` was never made, `npm ci` in a job's install or a merge's check cannot create it. Documented in `spawn.md` ("A cache folder not there yet is not made"); not run on a fresh host [INFERENCE: npm then fails with EACCES].
- Suggestion: `arthur doctor` names each missing cache of a manager the projects' lockfiles use, with `mkdir -p` as its fix; or `arthur setup` makes `~/.npm`. Making them at each spawn was left out: a test would then write into the real home folder.

## Goal

A fresh host's first install in a job does not fail on a package cache that was never made. Evidence: `packages/core/src/job-sandbox.ts` (`caches`) skips a writable path that is missing, so `npm ci` cannot create `~/.npm`; `spawn.md` documents it.

- Kind: ux

## Done means

- `arthur doctor` names each missing cache of a package manager the projects' lockfiles use, with `mkdir -p <path>` as its fix; a test with a temporary home covers a missing and a present cache.
- `npm run check` and `npm test` pass.

## Scope

In:
- The doctor check in `packages/core` (or the plugin that owns `doctor`) and its test, `packages/core/docs/commands/spawn.md`.

Out:
- Making the caches at each spawn: a test would write into the real home folder.

## Decisions

- 2026-10-26: Source: F2 of AR0449
