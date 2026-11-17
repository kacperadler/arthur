# AR0718 - npm test with as many files at once as the job's CPUs

Measured 2026-11-17 by job 2026-11-17-worker-49b51da7, on commit `7a418f2b`, in its worktree on this server: Node v24.21.0. `node -p 'require("os").availableParallelism()'` prints 11; the job's cgroup allows 3 CPUs (`cpu.max` = `300000 100000`; the jobs' slice above it, `1100000 100000`). Each time is `/usr/bin/time -f 'wall %e s user %U s sys %S s exit %x' npm test`; the load is `uptime`'s 1-minute average just before and just after each run. Other jobs ran on the server during the window, so the load moved between 3 and 17.

The two kinds of run alternated, so a busy stretch of the server weighs on both:

- Default: `package.json` as it is on `7a418f2b`, `node --import @arthur/core/testing --test "test/**/*.test.ts" "packages/*/test/**/*.test.ts"`: Node's default `--test-concurrency`, `availableParallelism() - 1`, 10 files at once.
- Concurrency 3: the same script with `--test-concurrency=3` after `--test`, edited into `package.json` in the worktree for the run and taken back after it (`git checkout -- package.json`), never committed.

## Answer

Faster with 3 files at once: 637.1 s against 730.7 s on the mean, 13 % less wall time, and 20 % less CPU (1618 against 2025 CPU-seconds). Each concurrency-3 run (633 to 645 s) was faster than every default run (717 to 743 s). No test failed with 3 at once; the one failure of the six runs is a default run's. So `npm test` now runs `--test-concurrency=$(node test/cpus.ts)`: `test/cpus.ts` prints the tightest `cpu.max` of the process's cgroup v2 and each cgroup above it, in whole CPUs and at least 1, else `os.availableParallelism()`.

## Times

| Run | Kind | Start-end | Wall | User CPU | Sys CPU | User + sys | Load before → after | Result |
|---|---|---|---|---|---|---|---|---|
| 1 | default | 09:49:51-10:01:48 | 717.25 s | 1380.50 s | 611.31 s | 1991.81 s | 12.51 → 3.21 | 1885 tests: 1821 pass, 0 fail, 64 skipped |
| 2 | concurrency 3 | 10:01:55-10:12:29 | 634.12 s | 1117.48 s | 479.44 s | 1596.92 s | 3.03 → 16.31 | 1885 tests: 1821 pass, 0 fail, 64 skipped |
| 3 | default | 10:12:33-10:24:56 | 742.71 s | 1423.81 s | 628.68 s | 2052.49 s | 16.92 → 8.87 | 1885 tests: 1820 pass, 1 fail, 64 skipped |
| 4 | concurrency 3 | 10:25:02-10:35:46 | 644.56 s | 1147.86 s | 495.11 s | 1642.97 s | 8.24 → 4.51 | 1885 tests: 1821 pass, 0 fail, 64 skipped |
| 5 | default | 10:35:49-10:48:01 | 732.01 s | 1409.35 s | 620.24 s | 2029.59 s | 4.31 → 11.94 | 1885 tests: 1821 pass, 0 fail, 64 skipped |
| 6 | concurrency 3 | 10:48:06-10:58:39 | 632.71 s | 1126.76 s | 486.20 s | 1612.96 s | 11.30 → 5.58 | 1885 tests: 1821 pass, 0 fail, 64 skipped |

| Kind | Mean wall | Mean user + sys | Cores busy (CPU / wall) |
|---|---|---|---|
| default | 730.66 s | 2024.63 s | 2.77 |
| concurrency 3 | 637.13 s | 1617.62 s | 2.54 |

The one failure, run 3 (default): `packages/herdr/test/herdr.test.ts`, "start makes the arthur workspace, its first tab the coordinator running arthur attach again and again; a later start makes no second one": `ENOENT: no such file or directory, rename '.../herdr-TlGZH1/.state.json' -> '.../state.json'` at `packages/herdr/test/fake-herdr.ts:132`. It passed in the other five runs (findings.md, F1).

## Where the time goes

Both kinds keep the 3 CPUs busy (2.77 and 2.54 cores on the mean), so the gain is not idle cores put to work: with 10 files at once on 3 CPUs, the same work costs about 400 CPU-seconds more [INFERENCE: from the user and sys times above; the cause, such as more processes waiting on the quota at once while their tests' timers and deadlines run, was not measured]. Single tests show it: the CLI's tests that start `arthur` many times took about a quarter of their default time at 3 at once (`inside a job (ARTHUR_JOB set) a command without inJob refuses ...`: 40.7 s in run 1, 9.5 s in run 2), as each file's processes wait for fewer others on the quota.
