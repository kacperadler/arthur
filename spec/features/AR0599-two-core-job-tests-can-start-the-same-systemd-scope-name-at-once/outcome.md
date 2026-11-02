# AR0599 - Outcome

- Merged: 2026-11-01, `091ae34b`
- Branch: arthur/2026-10-31-worker-111db639
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $9.00, reviews $1.40; review rounds 3

## What went in

- packages/core/src/inside-job.ts: exports `JOB_SCOPE`, which finds the job id at a cgroup path's end for both `arthur-job-<id>.scope` and `arthur-job-<id>.<ms>.scope`; `insideJob` uses it.
- packages/core/src/job-scope.ts: `launch` names a continued run's scope `arthur-job-<id>.<ms>.scope` (the record has `continue`); `ownScope` matches either name through `JOB_SCOPE`.
- packages/core/src/job-control.ts: the comment before the wrapper wait no longer says a continue reuses the scope's name.
- packages/delivery/src/processes-extension.ts: finds the job's processes in a continued run's scope as well.
- packages/core/test/job-control.test.ts: new test with a `systemd-run` that refuses a name it used once; each continue gets a new name, which `insideJob` maps back to the job.
- packages/core/test/inside-job.test.ts: a continued run's scope names the job; an id is one part of the path, never a record's folder below it.
- packages/core/test/scope.test.ts: real-systemd test that a continued run's scope has the new name, names its job, and has a daemon it forks killed at its end; the ticket-slice continue test reads the continued run's `MemoryMax` on the scope its wrapper runs in.
- packages/delivery/test/processes.test.ts: imports `JOB_SCOPE`; new real-systemd test of the reminder in a continued run's scope.
- packages/core/test/cli.test.ts: reads the job's scope with `JOB_SCOPE`.
- packages/develop/test/plugin-new.test.ts: reads the job's scope with `JOB_SCOPE`.
- packages/github/test/github.test.ts: reads the job's scope with `JOB_SCOPE`.
- packages/orchestration/test/decisions.test.ts: reads the job's scope with `JOB_SCOPE`.
- packages/schedule/test/registered.test.ts: reads the job's scope with `JOB_SCOPE`.
- packages/youtrack/test/youtrack.test.ts: reads the job's scope with `JOB_SCOPE`.
- test/structure.test.ts: core line budget 7056, main's 7054 plus this branch's 2 width-counted lines.
- packages/core/docs/commands/continue.md: the wait for an old wrapper rests on "two never run for one job"; the new run's scope has a new name.
- packages/core/docs/commands/spawn.md: documents the continued run's scope name and why; the journal stamp line names the run's scope.
- packages/core/docs/commands/help.md: the in-job mark includes a continued run's scope.
- packages/delivery/docs/delivery.md: the reminder reads a continued run's scope too.
- docs/deploy.md: the threat model's mark includes a continued run's scope.
- docs/plugin-api.md: `@arthur/core/inside-job` exports `JOB_SCOPE`; the `insideJob` text names both scope names.
- docs/setup.md: step 10 names a continued run's scope.
- spec/features/AR0599-two-core-job-tests-can-start-the-same-systemd-scope-name-at-once/findings.md: F1, `npm run mutate` stopped by SIGTERM partway through inside a job.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1388/1459 passed.

## Left open

- Tickets from findings: none open.
