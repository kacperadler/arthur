# AR0718 - Outcome

- Merged: 2026-11-17, `1b2c023f`
- Branch: arthur/2026-11-17-worker-49b51da7
- Reviews: review-1.md PASS
- Cost: worker $2.80, reviews $0.53; review rounds 1

## What went in

- `package.json`: the `test` script runs `node --test` with `--test-concurrency=$(node test/cpus.ts)`.
- `test/cpus.ts`: prints the CPUs this process may use: the tightest cgroup v2 `cpu.max` of its cgroup and every cgroup above it, in whole CPUs and at least 1, else `os.availableParallelism()`.
- `test/cpus.test.ts`: tests the count for a job's scope, a limit set higher up, fractions, a quota above the core count, no or broken `cpu.max`, cgroup v1, no `/proc`, a container's `0::/`, a hybrid machine's line, and `node test/cpus.ts` run as `npm test` runs it.
- `spec/features/AR0718-npm-test-runs-about-10-test-files-at-once-on-the-3-cores-a-job-gets-time-it-with/report.md`: the six timed runs (wall, CPU, counts, `uptime` before and after), their means, and the decision to keep concurrency at the CPU count.
- `spec/features/AR0718-npm-test-runs-about-10-test-files-at-once-on-the-3-cores-a-job-gets-time-it-with/findings.md`: F1, the fake herdr's shared temporary state file that failed one herdr test (open).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1821/1892 passed.

## Left open

- Deferred (client summary): F1. The fake herdr's state file is written through one shared temporary name, so two writers at once fail a herdr test
- Deferred (client summary): F2. adds to F1
