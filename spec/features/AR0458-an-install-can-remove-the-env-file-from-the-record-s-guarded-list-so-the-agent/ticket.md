# AR0458 - An install can remove the env file from the record's guarded list, so the agent reads it

```json
{
  "id": "AR0458",
  "title": "An install can remove the env file from the record's guarded list, so the agent reads it",
  "date": "2026-10-26"
}
```

## Description

F5 of AR0449 (spec/features/AR0449-the-install-at-a-job-start-and-the-merge-checks-run-branch-code-outside-the/findings.md).

- Kind: security
- Found by: 2026-10-26-review-47ad9a71 (reviewer), 2026-10-26
- Where: `packages/core/src/wrapper.ts:123` and `:128`
- What: the install's writable paths include the job's record folder, and the agent's sandbox re-reads `hidden(folder)` from the record's `guarded` file after the install. A lifecycle script that removes the `env /...` line from `guarded` leaves the env file readable to the agent and to every tool call of the job (a dependency's code during `npm test`). Not run; read from the two lines [INFERENCE]. The agent could already do this across a `continue`.
- Suggestion: compute `hidden(folder)` once before the install and reuse it, or leave the record out of the install's writable paths; a test where the install empties `guarded` and the agent still gets `EACCES`. Out: the agent's own writes to its record across a `continue`.

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

- 2026-10-26: Source: F5 of AR0449
