# AR0451 - Branch code run outside the sandbox can read Arthur's environment

```json
{
  "id": "AR0451",
  "title": "Branch code run outside the sandbox can read Arthur's environment",
  "date": "2026-10-26"
}
```

## Description

F1 of AR0440 (spec/features/AR0440-a-job-can-read-the-running-arthur-process-s-secrets-from-proc-pid-environ/findings.md).

- Kind: security
- Found by: 2026-10-26-plan-32afc87a (worker), 2026-10-26; recorded by 2026-10-26-worker-8dba5348 (worker)
- Where: `packages/core/src/job-install.ts:12`, `packages/delivery/src/merge-checks.ts` (`stepRunner`)
- What: the wrapper's install step (`install`, run before `sandboxed` in `wrapper.ts`) and the merge checks (install, `npm run check`, `npm test` of the merged main) run a branch's code, its lifecycle scripts and tests included, outside any Landlock domain, so that code can read `/proc/<pid>/environ` of `arthur run` and the coordinator. Inferred from the plan's bare run (an unsandboxed child read its parent's and a sibling's environment), not tested on these two paths. The owner's question is AR-D65, unanswered when this was written.
- Suggestion: run both steps through `sandboxed` with the package managers' caches (`~/.npm`, `~/.bun`) among the writable paths; the env file on disk stays out (AR0443).

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

- 2026-10-26: Source: F1 of AR0440
