# AR0541 - A worker ends its run while its npm test runs in the background, and has no way to read the result

```json
{
  "id": "AR0541",
  "title": "A worker ends its run while its npm test runs in the background, and has no way to read the result",
  "date": "2026-10-28"
}
```

## Description

Every worker this morning ended its run early once, saying it waits for a backgrounded `npm test`, and needed a continue that costs a turn and a wake. After this change a worker gets its test result in the same run.

## Goal

A worker's run never ends before the result of the checks it started. Evidence (2026-10-28): workers 2026-10-28-worker-0197a47f (AR0456), -118c34f2 (AR0414), -6ece3b9a (AR0478) and -32e5d3d8 (AR0523) each ended with a final message like "The full `npm test` run (bg_1) is still going"; the AR0414 worker said it has no wait tool and that reading `proc://bg_1` fails with `connect EACCES .../broker.sock` inside the sandbox. omp moves a long bash call to the background, and the job's agent has no way to wait for it.

- Kind: fix

## Done means

- A worker's run that starts `npm test` gets its result before the run ends: either omp's background move is off for jobs (an omp setting the wrapper passes) or the worker's role tells it how to run the checks so they finish in the call; a test with the fake agent shows the setting or the role text reaching the job, and fails without it.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/wrapper.ts` (the omp options of a job) or the worker role file, whichever the omp setting allows; their test.

Out:
- The coordinator's own session.

## Decisions
- 2026-10-29: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)

