# AR0660 - The model test reads every file of a job folder while the job still writes, and fails on a lock file that vanished

```json
{
  "id": "AR0660",
  "title": "The model test reads every file of a job folder while the job still writes, and fails on a lock file that vanished",
  "date": "2026-11-07"
}
```

## Description

The test "arthur continue runs the prepares again" lists every file in a job's folder and then reads each one, to check that no secret is in any of them. The job's `state.lock` can vanish between the list and the read, and then the test fails with ENOENT although nothing is wrong. AR0633 is the same race in the umask test.

## Goal

CI run 42371551500 failed on main (d88d4e4) with only this test failing:
`packages/core/test/model.test.ts:146`, `Error: ENOENT: no such file or directory, open '.../home/jobs/2026-10-16-worker-c3392eb6/state.lock'`. Main's code was unchanged by the merge that ran it: the race is in the test.

- Kind: test

## Done means

- `packages/core/test/model.test.ts` waits until the job has ended (no lock file left) before it reads the folder, or skips a file that is gone by the time it is read. A secret in any file that stays still fails the test.
- The test passes 20 runs in a row under load (`node --test packages/core/test/model.test.ts`, with the full suite running beside it once); npm run check and npm test pass.

## Scope

In:
- `packages/core/test/model.test.ts`: the read of the job folder at line 145-146.

Out:
- The umask test: AR0633.

## Decisions
- 2026-11-09: Merge AR0660 now; the owner: "Merge now" (AR-D581)
