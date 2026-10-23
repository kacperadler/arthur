# AR0056 - A `systemd-run` that fails after the slice was set leaves a job that never ends

```json
{
  "id": "AR0056",
  "title": "A `systemd-run` that fails after the slice was set leaves a job that never ends",
  "date": "2026-10-16"
}
```

## Description

`launch` decides between a scope and a bare job by whether `systemctl --user set-property` succeeds, then starts the wrapper through `systemd-run --user --scope` in the background. When `systemd-run` itself fails after that (missing while `systemctl` is there, or the manager refusing the scope), its message goes to `<home>/wrapper.log`, the wrapper never runs, and the record keeps no `state`: the job neither runs nor ends, and no `job-ended` is emitted. Not reproduced; read from the lines.

## Goal

Every job ends in a final state: a scope that systemd refuses to start never leaves a record at `running` with nothing behind it.

- Kind: security

Evidence:
- `packages/core/src/job-scope.ts`, `launch`
- Found by: 2026-10-16-ar0016-one-scope-per-job-d48b552c (worker), 2026-10-16

## Done means

- When `systemd-run` exits non-zero, or the wrapper never writes its `pid` within a short wait, the job's record is ended `failed` with the reason (`systemd-run: <stderr line>`), `job-ended` is emitted, and the worktree and branch stay for inspection; `arthur spawn` prints that line.
- A test with a fake `systemd-run` on `PATH` that exits 1: the record ends `failed` with the reason, one `job-ended`, nothing left running.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/job-scope.ts`, `jobs.ts` (move code out if it passes 200 lines), their tests.

Out:
- Dead jobs in general (entry 15).

## Decisions

- 2026-10-16: Source: F1 of AR0016
