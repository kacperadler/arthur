# AR0719 - npm test takes about 12 minutes of 3 busy cores: find which test files and which started processes use its CPU time

```json
{
  "id": "AR0719",
  "title": "npm test takes about 12 minutes of 3 busy cores: find which test files and which started processes use its CPU time",
  "date": "2026-11-17"
}
```

## Description

Every worker and every merge waits about 12 minutes for `npm test`. This ticket measures where that time goes, file by file and by the processes the tests start, and proposes the few changes that would save the most, which the coordinator files as planning tickets for the owner. It changes no code.

## Goal

The owner wants the tests faster (2026-11-17). AR0683's report (`spec/features/AR0683-measure-the-test-suite-on-bun-beside-node-and-report-whether-moving-the-tests-is/report.md`): `npm test` takes about 707 s wall and 1948 to 1969 CPU-seconds, so it is CPU-bound on the job's 3 cores; starting the CLI costs about 339 ms a process on Node (`node packages/core/src/cli.ts --help` ten times, 3.39 s), and the suite starts the CLI and the fake agent as child processes. AR0671 removed real waits and split the slowest file by wall time, not by CPU. AR0718 tunes how many files run at once; this ticket finds what each file costs.

- Kind: perf

## Done means

- `report.md` in this ticket's folder, measured on one commit of main:
  - every test file's CPU time (user plus sys, its child processes included) and wall time, each file run alone, sorted by CPU, with the top 20 in a table and the share of the whole they make;
  - how many child processes the suite starts, by what they run (the CLI, the fake agent, git, others), and the CPU they use together;
  - the 3 to 5 changes that would save the most CPU, each with its estimated saving in seconds and what it risks (a test that would check less).
- Each of those changes written in the report as a proposal ready to become a ticket (goal with its evidence, done means with the test that would prove it, scope by file); the coordinator files them.
- No source or test file changes; the project's checks pass.

## Scope

In:
- `spec/features/AR0719-.../report.md`.

Out:
- Changing any test or source file: the proposed tickets do that once the owner approves them.
- How many files run at once: AR0718.
- Moving to Bun: declined (AR-D687).

## Decisions
- 2026-11-17: AR0719 approved, budget 10, after AR0718; the owner: "AR-D689 approve" (AR-D689)
