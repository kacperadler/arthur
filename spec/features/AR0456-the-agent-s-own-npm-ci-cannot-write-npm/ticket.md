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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: fix

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-26: Source: F3 of AR0449
