# AR0423 - packages/core/test/job-state.test.ts:142 fails now and then with ENOENT on the job record active file

```json
{
  "id": "AR0423",
  "title": "packages/core/test/job-state.test.ts:142 fails now and then with ENOENT on the job record active file",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0356 (review 2026-10-25-review-9f53a5d9, non-blocking note): one full `npm test` run failed `packages/core/test/job-state.test.ts:142` ("a plugin's block wins over idle and over the agent's output; the run's end ends the hold") with `ENOENT` on `…/jobs/<id>/active`. Run alone it passed 14/14, and a second full run passed. The branch did not touch the file. The same kind of race was fixed in another test by AR0301.

## Goal

The test waits for the state it reads, so it never reads a job file that is not written yet or already removed; found by a stress run.

- Kind: test

## Done means

- The cause named from the test and the code that writes and removes `active` (file and line), then the test (or, if it is a real race, the code) fixed so a read cannot meet a missing file.
- Evidence: `for i in $(seq 30); do timeout 300 node --import @arthur/core/testing --test packages/core/test/job-state.test.ts || break; done` under load (e.g. beside `stress`-like CPU work) fails before or is shown to need the load, and passes 30 times after.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/test/job-state.test.ts`; a core source file only if the race is in the code, named in the final message.

Out:
- Other flaky tests.

## Decisions

- 2026-10-25: Source: F1 of AR0356
