# AR0067 - Two `arthur continue` at once can start two wrappers on one record where the job runs bare

```json
{
  "id": "AR0067",
  "title": "Two `arthur continue` at once can start two wrappers on one record where the job runs bare",
  "date": "2026-10-16",
  "after": [
    "AR0065"
  ]
}
```

## Description

`continueJob` checks that the state is final, then starts the wrapper, which writes `running` only when it runs. Two continues in that window both start a wrapper; in a scope the second `systemd-run` fails on the scope's name (and, as in AR0056, nothing reports it), but a job that runs bare gets two agents in one worktree, both writing the record. `arthur continue` also prints `continued` before the wrapper is known to have started.

## Goal

A job is continued once at a time: two `arthur continue` at once never start two wrappers on one record.

- Kind: security

Evidence:
- `packages/core/src/job-control.ts` (`continueJob`)
- Found by: 2026-10-16-ar0017-stop-continue-ste-6a96b243 (worker), 2026-10-16

## Done means

- `continueJob` takes the record before launching (an exclusive create of `<record>/continuing`, removed by the wrapper at start or when the continue fails); a second continue while it exists is refused `<id>: being continued`.
- A test runs two `arthur continue` at once on a finished job, with and without a user manager: exactly one wrapper starts, the other is refused, and the record ends once.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/job-control.ts`, `wrapper.ts`, their tests.

## Decisions

- 2026-10-16: Source: F3 of AR0017
