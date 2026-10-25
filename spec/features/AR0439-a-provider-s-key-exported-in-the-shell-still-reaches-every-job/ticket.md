# AR0439 - A provider's key exported in the shell still reaches every job

```json
{
  "id": "AR0439",
  "title": "A provider's key exported in the shell still reaches every job",
  "date": "2026-10-25"
}
```

## Description

F2 of AR0338 (spec/features/AR0338-a-secret-exported-in-the-shell-reaches-every-job-s-environment/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-edc68b52 (worker), 2026-10-25
- Where: `packages/core/src/job-scope.ts:68`
- What: `launch` drops only `ARTHUR_` variables (this ticket's scope), so a key the agent's providers read from the environment, such as `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` exported in the shell that started Arthur, is in the agent's environment and so in every tool call's (`env`), which the env guard does not refuse. The agent may need it to run, so dropping it blindly would break a setup that logs omp in through the shell.
- Suggestion: document that a provider's key belongs in omp's own login (`~/.omp`) or comes through the models plugin's `prepare`, and have `arthur doctor` warn about a known provider key in Arthur's environment. Out: dropping such keys in `launch` without the owner's decision.

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

- 2026-10-25: Source: F2 of AR0338
