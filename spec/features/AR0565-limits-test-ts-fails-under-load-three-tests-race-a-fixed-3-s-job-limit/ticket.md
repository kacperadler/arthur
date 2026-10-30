# AR0565 - limits.test.ts fails under load: three tests race a fixed 3 s job limit

```json
{
  "id": "AR0565",
  "title": "limits.test.ts fails under load: three tests race a fixed 3 s job limit",
  "date": "2026-10-30",
  "budget": 3
}
```

## Description

Three timeout tests in the core's limits test fail when the machine is busy, because the job's 3 s limit can end it before the state the test waits for appears. After this, those tests pass or fail on the behaviour they test, not on how fast the sandbox starts, and workers and reviewers stop filing them as failures.

## Goal

Every worker and reviewer runs the full suite while other worktrees run theirs, so these false failures keep showing up as findings and doubts in rounds that cost money. The styleguide asks for a test that "waits until the very state it asserts holds", and these three wait on a state a lost race never reaches.

Evidence:
- `packages/core/test/limits.test.ts:143,159,211`: three tests spawn a job with `timeoutMinutes: 0.05` (3 s). Each then waits at `:144`, `:160` and `:214` for something the job writes only if it gets past the sandbox's start within those 3 s: the tool's pid file, the install's pid file, or the `limit: budget: stopping the agent` log line.
- `:38`: `until` gives up after 20 s. If the 3 s limit ends the job first, the file or line never comes, so the test can only time out.
- The audit ran the `timeout during` tests alone on an idle host: the tool-call test took 3230 ms against its 3000 ms limit.
- Filed five times, always passing when the file runs alone: AR0425 F1, AR0494 F1, AR0541 F2, AR0544 F2, AR0552 F3.

- Kind: test

## Done means

- In each of the three tests, the wait ends on the job's end as well as on the awaited state, whichever comes first, and the test then asserts the reason the job ended with; or the tested limit gets a start point that does not depend on how fast the sandbox starts.
- Each of the three tests still fails when the limit it tests is removed from the job runner (shown in the final message, one mutation per test).
- The three tests pass when run with the job's start slowed past 3 s (for example under parallel load of the full suite twice at once), shown in the final message.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/test/limits.test.ts`: the three tests at `:143`, `:159`, `:211` and, if needed, the `until` helper at `:38`.

Out:
- The job limits and the wrapper stay as they are.
- No other test file is touched.

## Decisions

- 2026-10-30: Source: audit spec/quality/2026-10-30.md
- 2026-10-30: Pre-approved by policy: test from audit spec/quality/2026-10-30.md, 1 Scope file, budget $3 of the $3 cap
- 2026-10-30: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
