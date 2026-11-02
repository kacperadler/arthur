# AR0599 - Two core job tests can start the same systemd scope name at once

```json
{
  "id": "AR0599",
  "title": "Two core job tests can start the same systemd scope name at once",
  "date": "2026-10-31"
}
```

## Description

`arthur continue` on a job that has just ended may fail at once with `systemd-run: Failed to start transient scope unit: Unit arthur-job-<id>.scope was already loaded or has a fragment file.`: the scope of the run that ended has not been unloaded yet, and the continue asks for a scope of the same name. After this ticket a continue gets a scope it can start, or waits until the old one is gone, and the test that hit it passes every time.

## Goal

Source: CI run 41227127439, attempt 1, on `arthur/2026-10-31-worker-f364e259` at a6ff336: `packages/core/test/job-control.test.ts:705` (test at :684, "a continued worker moves its ticket from review back to in-progress ...") failed with `'systemd-run: Failed to start transient scope unit: Unit arthur-job-2026-10-16-audit-abd0d900.scope was already loaded or has a fragment file.' !== undefined`. The test spawns an audit job, waits for it to end (line 704), then continues it at once (line 705); attempt 2 of the same run passed this test. The same race can hit the owner's own `arthur continue` right after a job's end [INFERENCE: not seen in production yet].

- Kind: fix

## Done means

- A continue started while the ended run's scope is still loaded does not fail for the scope's name; a test with a `systemd-run` first on `PATH` that refuses a name already used once fails before the change and passes after it.
- `job-control.test.ts` passes 30 times in a row on this machine.
- `npm run check` and `npm test` pass.

## Scope

In:
- The core's job scope start (the file that builds the `systemd-run` call for a job's run).
- `packages/core/test/job-control.test.ts`.

## Decisions
- 2026-10-31: Approve AR0599 and add it to tonight's batch; the owner: "go with recomendations" (AR-D417)
