# AR0190 - `arthur continue` of a job on a provider model starts the agent without its provider

```json
{
  "id": "AR0190",
  "title": "`arthur continue` of a job on a provider model starts the agent without its provider",
  "date": "2026-10-19"
}
```

## Description

the variables a `prepare` returns (`OLLAMA_BASE_URL`, `OLLAMA_API_KEY`, `ARTHUR_AGENT_MODEL`) reach the wrapper's environment at the spawn only; they are in no file of the record, by design. `arthur continue` runs no `prepare`, so the continued agent gets `--model mac/qwen3-coder` (the record's name, which omp does not know) and no provider variables, and fails. [INFERENCE: read from the lines; no test runs a continue on a provider model.]

## Goal

A continued job on a provider model gets its provider again, exactly as at spawn.

- Kind: bug

Evidence:
- `packages/core/src/job-control.ts` (`continueJob`, which calls `launch` without variables), `packages/core/src/remote-job.ts` (`continue`)
- Found by: 2026-10-19-ar0187-models-d5226cf4 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: have `continueJob` run the prepares' variable part again (a `prepare` called with the job read from its record, its returned variables passed to `launch`, on another machine through `remote-job continue`'s stdin as `launch` does), with a test that continues a job on a provider model. Out: writing the variables into the record.
- `npm test` and `npm run check` pass.

## Scope

In:
- have `continueJob` run the prepares' variable part again (a `prepare` called with the job read from its record, its returned variables passed to `launch`, on another machine through `remote-job continue`'s stdin as `launch` does), with a test that continues a job on a provider model. Out: writing the variables into the record.

## Decisions

- 2026-10-19: Source: F1 of AR0187
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
- 2026-10-19: Host of the models and jobs core findings batch: AR0190, AR0191, AR0192, AR0193, AR0198, AR0202, built and merged together.
