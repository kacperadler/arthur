# AR0089 - Each sweep copies a job's whole `log` from another machine whenever it grew

```json
{
  "id": "AR0089",
  "title": "Each sweep copies a job's whole `log` from another machine whenever it grew",
  "date": "2026-10-16"
}
```

## Description

the copy sends every changed file whole. A long run's `log` (one line per tool call plus the agent's stderr) grows to megabytes and goes over SSH again every 30 s while the job is active, then is compared and rewritten here.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: improvement

Evidence:
- `packages/core/src/remote-job.ts` (`records`), `packages/core/src/job-machine.ts` (`syncMachine`)
- Found by: 2026-10-16-ar0024-jobs-on-another-m-bc3c12f4 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: ask for `log` from the size already copied (an offset per job, like `synced`) and append; keep whole files for the rest, which are small.
- `npm test` and `npm run check` pass.

## Scope

In:
- ask for `log` from the size already copied (an offset per job, like `synced`) and append; keep whole files for the rest, which are small.

## Decisions

- 2026-10-16: Source: F2 of AR0024
