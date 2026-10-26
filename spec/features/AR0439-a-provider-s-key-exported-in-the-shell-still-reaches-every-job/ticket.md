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

The owner learns when a model provider's key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and the like) sits in Arthur's own environment, where every job and its tool calls inherit it. Evidence: `packages/core/src/job-scope.ts:68` drops only `ARTHUR_` variables at a job's launch.

- Kind: security

## Done means

- `arthur doctor` warns, naming the variable and never its value, for each known provider key set in Arthur's environment, and says where it belongs: omp's own login, or the models plugin's `prepare`. Test in the doctor's tests: one key set, one warning without the value; none set, no line; fails on main.
- `docs/deploy.md` (threat model) says the same.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/doctor.ts`, its test, `docs/deploy.md`.

Out:
- Dropping such keys at a job's launch: it can break a setup that logs omp in through the shell; only on a separate owner decision.

## Decisions

- 2026-10-25: Source: F2 of AR0338
- 2026-10-26: Raise the core line budget 6228 to 6238 for AR0439; from now on raise the core line budget when a fix needs it, without asking; the owner: "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS" (AR-D61)
- 2026-10-26: Raise the core line budget by what the fix needs, without asking the owner; the owner: "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS" (AR-D61)
