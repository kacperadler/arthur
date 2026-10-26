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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: ux

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-26: Source: F2 of AR0449
