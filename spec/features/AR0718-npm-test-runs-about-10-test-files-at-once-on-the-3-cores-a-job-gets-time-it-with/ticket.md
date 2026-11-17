# AR0718 - npm test runs about 10 test files at once on the 3 cores a job gets; time it with --test-concurrency 3 and keep the faster

```json
{
  "id": "AR0718",
  "title": "npm test runs about 10 test files at once on the 3 cores a job gets; time it with --test-concurrency 3 and keep the faster",
  "date": "2026-11-17"
}
```

## Description

`npm test` runs about 10 test files at once in a job that may use only 3 CPUs, so the files fight for the cores. This ticket times the suite with as many files at once as the job's CPUs allow against today's default, and keeps the faster one, so every worker's and every merge's test run is shorter.

## Goal

From F1 of AR0683 (`spec/features/AR0683-measure-the-test-suite-on-bun-beside-node-and-report-whether-moving-the-tests-is/findings.md`, and its `report.md`): in a job on this server `node -p 'require("os").availableParallelism()'` prints 11 while the job's cgroup allows 3 CPUs (`cpu.max` = `300000 100000`). `package.json:16` runs `node --test` with no `--test-concurrency`, so Node runs files at its default, about availableParallelism minus one. Three timed `npm test` runs took about 707 s wall and 1948 to 1969 CPU-seconds each, CPU-bound on the quota. The owner kept the tests on Node (AR-D687); this looks for the speed on Node instead.

- Kind: perf

## Done means

- Timings in `report.md` in this ticket's folder: `npm test` at least three times as it is today and at least three times with `--test-concurrency` set to the CPUs the job's cgroup allows (3 here), each with wall time, CPU time, the pass and fail counts and `uptime` before and after, on the same commit.
- When the concurrency run is faster on the mean and fails no test the default passes: `npm test` runs with that many files at once, read from the CPUs the process may really use (the cgroup's `cpu.max` where there is one, `os.availableParallelism()` otherwise), so it fits a job, the owner's machine and a CI runner alike, never a fixed 3. When it is not faster, nothing in the code changes and the report says so.
- The project's checks pass.

## Scope

In:
- `package.json`: the `test` script.
- At most one small new file under `test/` that prints the CPU count for the script, if the script needs one.
- `spec/features/AR0718-.../report.md`: the timings.

Out:
- Moving the tests to Bun: declined (AR-D687).
- CI's shards and workflow: unchanged.
- Making single slow tests faster: AR0671 did that.

## Decisions
- 2026-11-17: AR0718 approved, budget 10; the owner: "AR-D688 approve" (AR-D688)
