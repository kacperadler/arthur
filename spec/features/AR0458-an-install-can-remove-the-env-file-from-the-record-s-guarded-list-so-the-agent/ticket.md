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

Since AR0449 a job's install runs in the sandbox, with the job's record folder among its writable paths (`packages/core/src/wrapper.ts:123`), and the agent's sandbox reads the hidden list again after the install (`hidden(folder)`, `wrapper.ts:128`). An install script that removes the env file's line from the record's guarded list leaves the env file readable to the agent and every tool call of the job.

- Kind: security

## Done means

- The hidden list is read once, before the install, and the same list hides the env file from the install and from the agent; what the install writes to the record cannot change it.
- A test in `packages/core/test/sandbox.test.ts`: an install that empties the record's guarded list, then an agent that reads the env file, gets `EACCES`, and the job's output holds no secret. It fails before the change. Skipped where the sandbox cannot be set up, as the other Landlock tests.
- The ticket's checks pass.

## Scope

In:
- `packages/core/src/wrapper.ts`: read `hidden(folder)` once.
- `packages/core/test/sandbox.test.ts`: the test.

Out:
- The agent's own writes to its record across a `continue`.
- A merge step's writes into `.git`: AR0457.

## Decisions

- 2026-10-26: Source: F5 of AR0449
- 2026-10-26: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D74)
