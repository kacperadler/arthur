# AR0719 - Where npm test's CPU time goes

Measured 2026-11-17, 13:48 to 15:14, by job 2026-11-17-worker-1db76016 on commit `793a1927` (main, "spec: AR0718 merged"), in its worktree: Node v24.21.0, git from the system, a cgroup of 3 CPUs (`cpu.max` = `300000 100000`) on a 12-core server other jobs share. `npm test` runs 188 files, 3 at once (`node test/cpus.ts` prints 3, AR0718). Every time is `/usr/bin/time -f "%e %U %S"`; CPU is user plus sys; the load is `/proc/loadavg`'s 1-minute average.

## Answer

- **Node processes the tests start are 62% of the CPU.** In a traced `npm test`, the CLI (999 starts), a job's wrapper (853), the fake agent (949) and the fake docker (609) used 1190 of 1925 CPU-seconds. Each start compiles Arthur's TypeScript from scratch: `node packages/core/src/cli.ts --help` costs 0.35 CPU-s, 0.084 CPU-s with Node's compile cache (10 runs each), against 0.02 for `node -e 0` (3 runs).
- **Node's compile cache cuts the suite by about a third.** With `NODE_COMPILE_CACHE` set to one new folder for the whole run, `npm test` took 1011 and 1156 CPU-s (435 and 507 s wall) against 1650 CPU-s (644 s wall) without it, with the same result each time: 1892 tests, 1828 pass, 0 fail, 64 skipped. That is proposal P1.
- **574 CLI starts do not get the cache from the environment**: the tests that start the CLI with a hand-built `env` (`cli.test.ts`, `job-gate.test.ts`, `spawn.test.ts` and 11 more) drop the variable. Passing it on cut `cli.test.ts` alone from 76.8 to 25.5 CPU-s. That is P2.
- **git is 8%**: 39,673 git processes, 157 CPU-s, about 4 ms each; a third of them are `rev-parse`.
- The 20 costliest files are 57% of the per-file CPU: 7 core files that start the CLI, 2 core files that start jobs, the docker plugin's 2 that start the fake docker, 7 of the delivery plugin's job and merge files, and the root's `test/mutate.test.ts` and `test/job-gate.test.ts`.

Together P1 to P5 below would save about 750 to 940 of the 1650 CPU-seconds [INFERENCE: P1 and P2 measured; P3 to P5 estimated from the census].

## Method

- **Whole runs**: `npm test` as the root script runs it, five times: plain twice (once under the tracer), with `NODE_COMPILE_CACHE=<worktree>/.arthur/ar0719/cc` (a new, empty folder each time) three times (once under the tracer).
- **Per file**: each of the 188 files alone, one after another, as `node --import @arthur/core/testing --test <file>` from the worktree's root. `/usr/bin/time` counts every child the runner waited for (`getrusage`'s children), not a process left running and adopted by another parent. The load ranged from 2.8 to 99 during these runs, from other jobs; wall times suffer from it more than CPU times.
- **Process census**: a ptrace tracer (source in the appendix) ran `npm test`. It follows every fork, vfork, clone and exec and stops no system call. At each thread's exit it reads `/proc/<pid>/task/*/schedstat` (nanoseconds on CPU per thread), so a process's CPU is its own threads only: the sums add up without counting a child twice. A process is grouped by the last program it executed (the fake agent's `omp` is `/bin/sh` and then `exec node fake-agent.ts`: one process, grouped as the fake agent) and assigned to the outermost test file among its ancestors. 81 of 56,522 processes ended with no exit seen (killed or still running when the run ended); their CPU is missing. The tracer agreed with `/usr/bin/time` on `node packages/core/src/cli.ts --help` (0.511 s and 0.51 s) and on `packages/core/test/run.test.ts` (14.41 s and 14.66 s). Under the tracer the suite used about 15% more CPU (1888 against 1650 CPU-s), so the census gives shares and per-start costs; the savings below are scaled to untraced runs.

## Whole runs

| Run | Start-end | Wall | User | Sys | CPU | Load before → after |
|---|---|---|---|---|---|---|
| plain | 14:56:12-15:06:57 | 644.20 s | 1155.34 s | 494.47 s | 1649.81 s | 3.87 → 7.83 |
| compile cache 1 | 14:32:08-14:40:36 | 507.39 s | 727.35 s | 428.96 s | 1156.31 s | 8.25 → 22.75 |
| compile cache 2 | 15:07:04-15:14:19 | 434.95 s | 640.66 s | 370.36 s | 1011.02 s | 7.28 → 7.43 |
| plain, traced | 14:17:30-14:30:03 | 753.77 s | 1293.05 s | 595.44 s | 1888.49 s | 2.83 → 20.50 |
| compile cache, traced | 14:41:43-14:51:13 | 570.19 s | 759.21 s | 471.19 s | 1230.40 s | 16.51 → 14.40 |

Each run: 1892 tests, 1828 pass, 0 fail, 64 skipped, exit 0. The cache folder held 20 MB after a run. `test/mutate.test.ts` passed with the cache on too: it edits source files between runs and expects their tests to catch the change, so a stale cached compile would have failed it.

## Per file, each alone

All 188 files took 1776.7 CPU-s and 1733.6 s wall when run alone one after another, all exit 0. This sum is higher than a whole plain run (1649.8 CPU-s): each file here starts its own runner, and the server's load differed. The top 20 take 1014.1 CPU-s, 57.1% of it. "Starts" is from the traced plain run.

| # | File | CPU s | User s | Sys s | Wall s | Share | Cumulative | Tests | What it starts, most CPU first (traced) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `packages/core/test/cli.test.ts` | 107.3 | 90.9 | 16.4 | 72.4 | 6.0% | 6.0% | 25 | 210 CLI (94.7 s) |
| 2 | `packages/docker/test/sweep.test.ts` | 100.6 | 78.0 | 22.6 | 80.5 | 5.7% | 11.7% | 13 | 329 fake docker (84.8 s) |
| 3 | `packages/delivery/test/auto-merge.test.ts` | 74.6 | 46.4 | 28.1 | 55.6 | 4.2% | 15.9% | 12 | 77 wrapper (28.6 s), 77 fake agent (22.9 s), 3118 git (11.7 s) |
| 4 | `packages/core/test/machine-spawn.test.ts` | 67.4 | 52.2 | 15.2 | 86.2 | 3.8% | 19.7% | 16 | 99 CLI (40.0 s), 23 wrapper (7.6 s), 782 git (2.5 s) |
| 5 | `test/mutate.test.ts` | 56.8 | 43.2 | 13.6 | 38.0 | 3.2% | 22.9% | 12 | 145 nested test-file processes (62.7 s), 144 nested runners (11.9 s) |
| 6 | `packages/core/test/job-control.test.ts` | 56.3 | 37.2 | 19.0 | 74.0 | 3.2% | 26.1% | 36 | 53 wrapper (19.3 s), 43 fake agent (11.5 s), 828 git (2.9 s) |
| 7 | `packages/docker/test/cleanup.test.ts` | 55.1 | 42.2 | 12.9 | 40.2 | 3.1% | 29.2% | 10 | 221 fake docker (57.4 s) |
| 8 | `packages/core/test/machine-log.test.ts` | 50.2 | 39.8 | 10.4 | 51.3 | 2.8% | 32.0% | 7 | 83 CLI (37.1 s), 11 wrapper (4.1 s) |
| 9 | `packages/delivery/test/hand-back.test.ts` | 48.1 | 31.7 | 16.5 | 33.2 | 2.7% | 34.7% | 11 | 57 wrapper (21.3 s), 57 fake agent (16.9 s), 1492 git (5.3 s) |
| 10 | `packages/delivery/test/merge.test.ts` | 45.8 | 27.9 | 17.9 | 40.7 | 2.6% | 37.3% | 9 | 30 wrapper (11.6 s), 30 fake agent (9.5 s), 1719 git (6.7 s) |
| 11 | `packages/core/test/machine-control.test.ts` | 45.4 | 34.9 | 10.4 | 36.3 | 2.6% | 39.8% | 10 | 78 CLI (34.5 s), 14 wrapper (5.2 s) |
| 12 | `packages/delivery/test/merge-outcome.test.ts` | 44.4 | 27.1 | 17.2 | 37.0 | 2.5% | 42.3% | 8 | 30 wrapper (11.3 s), 30 fake agent (9.2 s), 38 npm (6.8 s), 1654 git (6.6 s) |
| 13 | `packages/core/test/spawn.test.ts` | 35.7 | 28.3 | 7.4 | 30.1 | 2.0% | 44.3% | 17 | 71 CLI (30.5 s), 25 wrapper (8.3 s) |
| 14 | `test/job-gate.test.ts` | 34.3 | 29.7 | 4.6 | 22.2 | 1.9% | 46.3% | 2 | 64 CLI with 15 plugins loaded (54.5 s, 0.85 s a start) |
| 15 | `packages/core/test/job-records.test.ts` | 34.2 | 24.4 | 9.8 | 25.8 | 1.9% | 48.2% | 24 | 26 CLI (10.4 s), 29 wrapper (9.8 s) |
| 16 | `packages/delivery/test/merge-main.test.ts` | 32.7 | 19.3 | 13.4 | 26.8 | 1.8% | 50.0% | 10 | 22 wrapper (8.6 s), 22 fake agent (6.9 s), 1480 git (5.9 s) |
| 17 | `packages/core/test/job-machine.test.ts` | 32.1 | 24.1 | 8.0 | 26.6 | 1.8% | 51.8% | 16 | 66 CLI (30.0 s), 12 wrapper (4.3 s) |
| 18 | `packages/delivery/test/merge-steps.test.ts` | 31.5 | 19.2 | 12.2 | 28.4 | 1.8% | 53.6% | 8 | 21 wrapper (7.8 s), 21 fake agent (6.3 s), 1067 git (4.1 s) |
| 19 | `packages/delivery/test/review.test.ts` | 30.9 | 19.5 | 11.5 | 26.4 | 1.7% | 55.3% | 12 | 30 wrapper (12.8 s), 30 fake agent (9.9 s), 1091 git (4.6 s) |
| 20 | `packages/core/test/machine-sync.test.ts` | 30.9 | 22.6 | 8.3 | 25.7 | 1.7% | 57.1% | 8 | 51 CLI (20.9 s), 11 wrapper (3.7 s) |

The traced CPU of a file differs from its alone CPU where it ran beside two others (`test/mutate.test.ts` 89.5 s traced, 56.8 s alone; `test/job-gate.test.ts` 55.4 s and 34.3 s). The other 168 files are in the appendix. The cheapest file costs 0.4 CPU-s alone: a runner, a test process, the kit and its exit cleanup.

## The processes the suite starts

56,522 processes in the traced plain run, 56,532 in the traced cached one (a process here is one fork, and keeps its group through `exec`). CPU is each process's own threads.

| What it runs | Plain: processes | Plain: CPU s | Share | With compile cache: CPU s | Change |
|---|---|---|---|---|---|
| node: the CLI, `packages/core/src/cli.ts` | 999 | 474.0 | 24.6% | 358.0 | -116.0 |
| node: a test file's process (188 files, plus the fixtures `test/mutate.test.ts` and others run) | 411 | 328.1 | 17.0% | 228.5 | -99.6 |
| node: a job's wrapper, `packages/core/src/wrapper.ts` | 853 | 311.7 | 16.2% | 109.6 | -202.1 |
| node: the fake agent, `packages/core/src/fake-agent.ts` | 949 | 246.1 | 12.8% | 154.0 | -92.1 |
| node: the fake docker, `packages/docker/test/fake-docker.ts` | 609 | 157.9 | 8.2% | 42.3 | -115.6 |
| git (and `/usr/lib/git-core/git`, `git-upload-pack`, `git-receive-pack`, ...) | 39,673 | 157.1 | 8.2% | 136.4 | -20.7 |
| node: other (`fake-herdr.ts`, fake `tmux`, `node -e` children, `test/mutate.ts`, `test/release.ts`) | 1,067 | 75.8 | 3.9% | 56.2 | -19.6 |
| sh and bash (`sh -c`, the tests' fake `ssh`, `docker`, `systemctl`, `bun`, `tmux` scripts) | 5,135 | 58.1 | 3.0% | 55.9 | -2.2 |
| npm (`npm test`, `npm run check`, `npm ci` of the delivery and update tests' projects) | 154 | 32.5 | 1.7% | 31.1 | -1.4 |
| others (`cat` 1088, `sleep` 836, `find` 521, `ps` 387, `tsc` 9, `ssh`, `curl`, ...) | 4,207 | 30.2 | 1.6% | 33.9 | +3.7 |
| chromium headless (`test/report-check.test.ts`) | 343 | 23.0 | 1.2% | 18.6 | -4.4 |
| node: a `node --test` runner (the root one and the nested ones) | 150 | 14.4 | 0.7% | 12.5 | -1.9 |
| systemctl, systemd-run (the kit's exit cleanup and jobs' scopes) | 1,780 | 10.9 | 0.6% | 8.7 | -2.2 |
| python3 (the job sandbox's Landlock launcher, the merge sweep) | 192 | 5.3 | 0.3% | 4.4 | -0.9 |
| **Total** | **56,522** | **1925.1** | | **1250.1** | **-675.0** |

The Node processes the tests start (the CLI, the wrapper, the fake agent, the fake docker, the other node children and the nested runners) used 1280 of 1925 CPU-s; with the test files' own processes, Node is 1608 CPU-s, 84%.

Git, by subcommand (plain traced run): `rev-parse` 13,749 processes and 45.8 s, `commit` 2,070 and 13.6 s, `config` 3,416 and 11.6 s, `add` 1,675 and 9.8 s, `init` 1,668 and 9.7 s, `worktree` 1,126 and 5.8 s, `maintenance` 2,351 and 5.6 s (`git maintenance run --auto` after commits), `log` 1,348 and 5.1 s, `reset` 979 and 4.9 s, `branch` 1,015 and 3.3 s. Of the `rev-parse` calls, 4,331 are `rev-parse --show-toplevel` and 2,034 are `HEAD^{commit}` lookups with Arthur's hardened flags (`packages/core/src/git.ts`): `topLevel` and `head` ask git twice each, once for the exit status and once for the answer.

What a Node start costs (10 runs each unless named):

| Command | CPU s a start | Wall s a start |
|---|---|---|
| `node -e 0` (3 runs) | 0.02 | 0.02 |
| `node packages/core/src/cli.ts --help` | 0.350 | 0.206 |
| the same with a warm `NODE_COMPILE_CACHE` | 0.084 | 0.080 |
| `node --input-type=module -e 'await import("@arthur/core")'` from `packages/docker` (5 runs) | 0.224 | - |
| the same with a warm `NODE_COMPILE_CACHE` (4 warm runs) | 0.053 | - |

With the cache passed through the environment, the CLI cost 0.14 CPU-s a start where it inherited the variable (413 starts, 57.9 s) and still 0.52 where a test hands it a `env` of its own (574 starts, 298.0 s). The fake agent: 0.13 (663 starts) against 0.29 (206 starts, 60.1 s).

## Proposals

Ordered by CPU saved. Each saving is in untraced CPU-seconds of one `npm test` on 3 CPUs; the wall time falls by roughly a third of it, since the suite keeps the 3 CPUs busy.

### P1. Node's compile cache for every process of a test run

- Kind: perf
- Saving: about 490 to 640 CPU-s and 140 to 210 s wall of 1650 CPU-s and 644 s (measured).
- Risk: low. The same code runs; only V8's compile step is skipped where a module's text is unchanged. Node checks each entry against the source and its own version [INFERENCE from Node's documentation of `module.enableCompileCache`; `test/mutate.test.ts`, which edits sources between runs, passed with the cache on]. A cache folder that cannot be written only turns the cache off. Tests check nothing less.
- Goal: every Node process `npm test`, CI's shard line or `node --import @arthur/core/testing --test <file>` starts reuses compiled modules, so each start stops paying 0.27 CPU-s to compile the core (evidence: the tables above; 1650 → 1011 and 1156 CPU-s, 644 → 435 and 507 s wall, 1828 pass, 0 fail each).
- Done means:
  - `packages/core/src/test-env.ts`, the kit's first module, calls `module.enableCompileCache(<folder>)` and sets `process.env.NODE_COMPILE_CACHE` to the same absolute folder when unset, so the test file and every child that inherits the environment use one cache; the folder is the checkout's own, e.g. `node_modules/.cache/arthur-test-compile` beside the root `package.json` (gitignored, never a production path nor a fixed `/tmp` one).
  - A test fails when it is removed: a `node -e` child started with `process.env` prints `module.getCompileCacheDir()` inside that folder.
  - `/usr/bin/time -f "%e %U %S" npm test` three times before and three after, on one commit, in the merge's outcome: CPU down by at least 400 s.
- Scope:
  - In: `packages/core/src/test-env.ts`, its comment, the new test in `packages/core/test/testing.test.ts`.
  - Out: production processes (an `arthur` command or a job's wrapper with the cache is a product question for the owner: a static `import` runs before the call, so `cli.ts` would need a small entry that enables the cache and then imports the rest); the runner's own process, which loads before the kit.

### P2. The processes a test starts with an environment of its own get the cache too

- Kind: perf
- Saving: about 200 to 235 CPU-s after P1 (measured on one file: `packages/core/test/cli.test.ts` alone, with the cache set, 76.8 CPU-s and 41.9 s wall as it is, 25.5 CPU-s and 21.7 s wall with the variable passed to its 5 `spawnSync` calls; all 25 tests pass in both).
- Risk: low. A test that hands the CLI a bare environment checks that the CLI needs nothing else; `NODE_COMPILE_CACHE` changes no code path of Arthur's. A test that compares a child's whole environment would see one more variable: none failed in the measured file. Node drops a variable whose value is `undefined`, so a run without the cache passes nothing.
- Goal: after P1, 574 CLI starts (298 of 1250 traced CPU-s) and 206 fake-agent starts (60 CPU-s) still compile everything, because the test passes `env: { PATH, XDG_CONFIG_HOME, ... }`.
- Done means:
  - every `env` a test builds for a `node` child (the CLI, `wrapper.ts`, a fake) carries `NODE_COMPILE_CACHE: process.env.NODE_COMPILE_CACHE`, or the kit exports one helper that builds such an env (14 files, so it is not an abstraction before its second example);
  - the traced count of CLI starts above 0.25 CPU-s falls from 574 to near 0, or `/usr/bin/time` on `packages/core/test/cli.test.ts` alone falls from about 77 to about 26 CPU-s with P1 on;
  - `npm run check && npm test` pass.
- Scope, by CLI CPU of the bare starts (traced, with the cache): In: `packages/core/test/cli.test.ts` (210 starts, 106.5 s), `test/job-gate.test.ts` (64, 40.9 s), `packages/core/test/spawn.test.ts` (71, 33.9 s), `packages/core/test/doctor.test.ts` (38, 20.9 s), `packages/orchestration/test/decisions.test.ts` (24, 15.3 s), `packages/core/test/job-records.test.ts` (26, 13.2 s), `packages/core/test/run.test.ts` (27, 12.7 s), `packages/core/test/job-control.test.ts` (21, 10.5 s), `packages/core/test/config-check.test.ts`, `packages/core/test/setup.test.ts`, `packages/orchestration/test/board-commands.test.ts`, `packages/core/test/secret-names.test.ts`, `test/job-home.test.ts`, `test/piece-order.test.ts` (3.0 to 7.3 s each). Out: production code; the number of CLI starts.

### P3. The delivery tests' projects run their checks without real npm

- Kind: perf
- Saving: about 20 to 30 CPU-s (estimated: 154 npm starts used 31.1 CPU-s with the cache, 0.2 s each; a fake `npm` that runs the script's command costs a shell or a cached node start).
- Risk: medium. These tests no longer show that real npm finds and runs the project's `check` and `test` scripts; keep real npm where that is the point (`packages/delivery/test/merge-checks.test.ts`, which checks npm's cache folder, and one merge test).
- Goal: a merge in a test runs `npm run check` and `npm test` of a two-script project (`packages/delivery/test/merge-setup.ts`: `node -e ""` and `node test.js`); npm itself is most of their cost.
- Done means: a fake `npm` first on the PATH the merge's steps get, which runs the named script with `sh -c` and keeps npm's exit status and signal handling (`merge-steps.test.ts` kills a step that ignores SIGTERM); the merge outputs the tests compare stay as they are; the traced count of npm starts falls from 154 to the few kept; `npm test` passes.
- Scope: In: `packages/delivery/test/merge-setup.ts`, `merge.test.ts` (35 npm starts), `merge-outcome.test.ts` (38), `merge-main.test.ts` (24), `merge-steps.test.ts` (18), `auto-merge.test.ts` (16). Out: `packages/core/test/update.test.ts` (14 starts of `npm ci`, the update's real work), `packages/delivery/src/merge-checks.ts`.

### P4. The fake docker stops loading the whole core

- Kind: perf
- Saving: about 20 CPU-s after P1, about 120 CPU-s without it (estimated: 609 starts; `import "@arthur/core"` costs 0.224 CPU-s cold and 0.053 warm, against 0.02 for a bare start).
- Risk: low. The fake docker uses one function of the core, `memoryBytes`, to read `--max-used-space`; `@arthur/core`'s main export is `config.ts`, which loads most of the core.
- Goal: `packages/docker/test/sweep.test.ts` (100.6 CPU-s alone, 2nd) and `cleanup.test.ts` (55.1, 7th) spend 142 of their 156 CPU-s in the fake docker, one node process per `docker` or `ssh` call.
- Done means: `packages/docker/test/fake-docker.ts` imports only what it uses through a published export that loads no more than `packages/core/src/job-memory.ts` (a new subpath export of `@arthur/core`), or parses the size itself; `docker-shapes.json` answers stay the same; `/usr/bin/time` on `sweep.test.ts` alone falls by at least 60 CPU-s without P1; the docker tests and `packages/docker/test/fake-shapes.test.ts` pass.
- Scope: In: `packages/docker/test/fake-docker.ts`, `packages/core/package.json` if a subpath is added. Out: the number of docker calls a test makes.

### P5. Fewer git processes: one call where the core asks twice, no auto maintenance in tests

- Kind: perf
- Saving: about 15 CPU-s (estimated: about 3,200 `rev-parse` processes at 3.3 ms and 2,351 `git maintenance` processes at 2.4 ms in the traced run).
- Risk: low. `topLevel` and `head` keep their answers; the kit's git config gains `maintenance.auto = false`, and no test checks Git's own maintenance. The production part (`git.ts`) also saves a git process each time a job or command asks.
- Goal: `topLevel` and `head` in `packages/core/src/git.ts` run `git rev-parse` once for the exit status (`yes`) and again for the output (`git`): 4,331 `--show-toplevel` and 2,034 `HEAD^{commit}` calls in the suite. Every test commit also starts `git maintenance run --auto`.
- Done means: each of `topLevel` and `head` makes one `spawnSync` and reads both its status and its output; their tests (outside Git, a repository without commits, a name that is no commit) still pass; `packages/core/src/test-env.ts` writes `[maintenance]\n\tauto = false` into the kit's git config; the traced git count falls by at least 5,000.
- Scope: In: `packages/core/src/git.ts`, `packages/core/src/test-env.ts`, their tests. Out: the delivery and job code's other git calls.

### Looked at and not proposed

- `packages/dokploy/test/dokploy.test.ts`: one test, "upload refuses before any request ... past 65535 files or 4 GiB", runs 10.7 s of the file's 20.6 s wall (22.1 CPU-s) writing 65,536 files and zipping 65,535; a smaller limit would no longer test the real one.
- `test/report-check.test.ts`: 171 Chrome starts (23.0 CPU-s with their forks) come from the page check in `.agents/arthur/criteria/report.md`, which starts Chrome for each page load and each screenshot slice; fewer starts means changing that check.
- `test/mutate.test.ts`: its 145 nested test-file processes cost 62.7 CPU-s plain, 22.7 with the cache; P1 takes most of it, and fewer mutants would test less.
- A job's wrapper and the fake agent after P1: 109.6 and 154.0 CPU-s, mostly the work of each job a test runs.
- Lazy loading in the CLI: with the cache a start still costs 0.084 CPU-s against 0.02 for `node -e 0` [INFERENCE: module evaluation; not measured further]; at most about 60 CPU-s over 999 starts, and a change to production code.

## Appendix: every file, alone

Files 21 to 188, sorted by CPU (user plus sys, children included), with their wall time; files 1 to 20 are in the table above.

| # | File | CPU s | Wall s |
|---|---|---|---|
| 21 | `packages/core/test/wrapper.test.ts` | 27.0 | 19.4 |
| 22 | `packages/core/test/doctor.test.ts` | 23.3 | 17.0 |
| 23 | `packages/core/test/worktree-guard.test.ts` | 23.1 | 14.7 |
| 24 | `packages/orchestration/test/decisions.test.ts` | 22.6 | 11.5 |
| 25 | `packages/dokploy/test/dokploy.test.ts` | 22.1 | 20.6 |
| 26 | `packages/core/test/limits.test.ts` | 21.1 | 31.6 |
| 27 | `packages/orchestration/test/plans.test.ts` | 18.9 | 11.2 |
| 28 | `packages/develop/test/plugin-new.test.ts` | 18.2 | 12.4 |
| 29 | `packages/develop/test/eval.test.ts` | 17.9 | 32.6 |
| 30 | `packages/commit-rules/test/commit-rules.test.ts` | 17.3 | 9.5 |
| 31 | `packages/delivery/test/ticket-prune.test.ts` | 16.7 | 14.9 |
| 32 | `packages/core/test/sandbox.test.ts` | 16.3 | 16.3 |
| 33 | `packages/orchestration/test/project-agents.test.ts` | 15.2 | 22.5 |
| 34 | `packages/session/test/restart-guard.test.ts` | 14.4 | 7.2 |
| 35 | `packages/orchestration/test/spawn-rules.test.ts` | 14.2 | 8.3 |
| 36 | `packages/core/test/roles.test.ts` | 13.8 | 8.4 |
| 37 | `packages/herdr/test/herdr.test.ts` | 13.7 | 19.1 |
| 38 | `packages/core/test/run.test.ts` | 13.6 | 15.1 |
| 39 | `packages/manage/test/pyramid.test.ts` | 13.3 | 6.9 |
| 40 | `packages/develop/test/scenarios.test.ts` | 13.1 | 17.0 |
| 41 | `test/report-check.test.ts` | 13.0 | 13.5 |
| 42 | `packages/core/test/config-check.test.ts` | 12.4 | 9.2 |
| 43 | `packages/delivery/test/merge-checks.test.ts` | 12.3 | 13.5 |
| 44 | `packages/manage/test/retro.test.ts` | 11.6 | 8.4 |
| 45 | `packages/core/test/update.test.ts` | 11.3 | 9.7 |
| 46 | `packages/delivery/test/pass-forward.test.ts` | 10.9 | 15.1 |
| 47 | `packages/delivery/test/review-needed.test.ts` | 10.8 | 10.6 |
| 48 | `packages/core/test/job-state.test.ts` | 9.3 | 17.2 |
| 49 | `packages/core/test/jobs.test.ts` | 9.0 | 4.6 |
| 50 | `packages/core/test/setup.test.ts` | 8.5 | 10.9 |
| 51 | `packages/projects/test/install.test.ts` | 8.2 | 6.4 |
| 52 | `packages/core/test/scope.test.ts` | 7.9 | 9.0 |
| 53 | `packages/core/test/model.test.ts` | 7.9 | 6.1 |
| 54 | `packages/manage/test/audit.test.ts` | 7.6 | 4.5 |
| 55 | `packages/docker/test/docker.test.ts` | 7.6 | 5.0 |
| 56 | `packages/resources/test/feature-caps.test.ts` | 7.4 | 18.9 |
| 57 | `packages/docker/test/fake-shapes.test.ts` | 7.3 | 4.8 |
| 58 | `packages/core/test/secret-names.test.ts` | 7.1 | 7.4 |
| 59 | `packages/github/test/github.test.ts` | 6.8 | 33.3 |
| 60 | `packages/core/test/testing.test.ts` | 6.7 | 4.0 |
| 61 | `packages/github/test/github-branch.test.ts` | 6.6 | 8.3 |
| 62 | `packages/orchestration/test/board-commands.test.ts` | 6.3 | 3.6 |
| 63 | `packages/models/test/models.test.ts` | 6.3 | 5.3 |
| 64 | `packages/nvm/test/nvm.test.ts` | 5.6 | 3.8 |
| 65 | `packages/delivery/test/checks.test.ts` | 5.5 | 5.3 |
| 66 | `packages/github/test/github-pr.test.ts` | 5.4 | 4.0 |
| 67 | `packages/core/test/lock.test.ts` | 5.1 | 4.8 |
| 68 | `packages/projects/test/onboarding.test.ts` | 5.1 | 3.8 |
| 69 | `packages/orchestration/test/decision-use.test.ts` | 5.0 | 2.8 |
| 70 | `packages/findings/test/findings-command.test.ts` | 5.0 | 3.7 |
| 71 | `packages/schedule/test/schedule.test.ts` | 4.7 | 2.0 |
| 72 | `packages/core/test/git-config.test.ts` | 4.4 | 4.5 |
| 73 | `packages/schedule/test/registered.test.ts` | 4.0 | 1.5 |
| 74 | `packages/session/test/compaction.test.ts` | 3.9 | 9.5 |
| 75 | `packages/machines/test/machines.test.ts` | 3.9 | 4.8 |
| 76 | `test/outside-text.test.ts` | 3.7 | 1.8 |
| 77 | `packages/docker/test/labels.test.ts` | 3.6 | 3.0 |
| 78 | `packages/orchestration/test/context.test.ts` | 3.4 | 2.4 |
| 79 | `test/ci-wait-wake.test.ts` | 3.3 | 7.4 |
| 80 | `packages/orchestration/test/job-states.test.ts` | 3.3 | 2.4 |
| 81 | `test/findings-merge.test.ts` | 3.2 | 2.3 |
| 82 | `packages/session/test/service.test.ts` | 3.1 | 8.4 |
| 83 | `packages/manage/test/repeats.test.ts` | 3.0 | 1.6 |
| 84 | `packages/core/test/events.test.ts` | 3.0 | 1.8 |
| 85 | `packages/resources/test/room.test.ts` | 2.7 | 7.6 |
| 86 | `test/piece-order.test.ts` | 2.6 | 1.6 |
| 87 | `packages/session/test/sessions.test.ts` | 2.6 | 5.6 |
| 88 | `packages/session/test/session.test.ts` | 2.6 | 7.7 |
| 89 | `packages/session/test/restart-command.test.ts` | 2.5 | 7.0 |
| 90 | `packages/resources/test/disk.test.ts` | 2.5 | 8.7 |
| 91 | `packages/session/test/restart.test.ts` | 2.5 | 12.4 |
| 92 | `test/onboarding-merge.test.ts` | 2.5 | 1.8 |
| 93 | `packages/video/test/video.test.ts` | 2.3 | 4.9 |
| 94 | `test/other-projects.test.ts` | 2.3 | 1.4 |
| 95 | `packages/session/test/start-notice.test.ts` | 2.2 | 3.8 |
| 96 | `packages/delivery/test/merge-command.test.ts` | 2.2 | 1.8 |
| 97 | `packages/youtrack/test/youtrack.test.ts` | 2.1 | 1.5 |
| 98 | `packages/delivery/test/processes.test.ts` | 2.1 | 2.4 |
| 99 | `test/release.test.ts` | 2.0 | 1.7 |
| 100 | `packages/core/test/job-follow.test.ts` | 2.0 | 1.6 |
| 101 | `packages/core/test/board.test.ts` | 2.0 | 1.4 |
| 102 | `packages/speak/test/speak.test.ts` | 2.0 | 4.0 |
| 103 | `packages/telegram/test/telegram.test.ts` | 1.9 | 25.4 |
| 104 | `packages/listen/test/listen.test.ts` | 1.8 | 4.0 |
| 105 | `packages/delivery/test/worker-criteria.test.ts` | 1.8 | 1.5 |
| 106 | `packages/delivery/test/changelog-fetch.test.ts` | 1.8 | 1.5 |
| 107 | `packages/uptime/test/uptime.test.ts` | 1.7 | 45.4 |
| 108 | `packages/delivery/test/changelog.test.ts` | 1.7 | 1.5 |
| 109 | `packages/github/test/github-issue.test.ts` | 1.6 | 1.1 |
| 110 | `packages/projects/test/projects.test.ts` | 1.5 | 1.3 |
| 111 | `packages/discord/test/discord.test.ts` | 1.5 | 10.8 |
| 112 | `packages/dokploy/test/dokploy-postgres.test.ts` | 1.4 | 1.7 |
| 113 | `packages/dokploy/test/dokploy-source.test.ts` | 1.4 | 1.1 |
| 114 | `packages/discord/test/menu.test.ts` | 1.4 | 1.4 |
| 115 | `packages/manage/test/health-checks.test.ts` | 1.4 | 1.1 |
| 116 | `packages/discord/test/gateway.test.ts` | 1.4 | 12.0 |
| 117 | `packages/manage/test/release-notice.test.ts` | 1.3 | 1.6 |
| 118 | `packages/orchestration/test/paper-check.test.ts` | 1.3 | 1.0 |
| 119 | `packages/orchestration/test/silent.test.ts` | 1.2 | 1.0 |
| 120 | `packages/orchestration/test/coordinator.test.ts` | 1.2 | 6.9 |
| 121 | `packages/session/test/doctor.test.ts` | 1.2 | 0.9 |
| 122 | `packages/dokploy/test/dokploy-setup.test.ts` | 1.2 | 1.0 |
| 123 | `test/room-placement.test.ts` | 1.1 | 3.6 |
| 124 | `packages/manage/test/manage.test.ts` | 1.1 | 5.8 |
| 125 | `packages/herdr/test/fake-shapes.test.ts` | 1.1 | 0.8 |
| 126 | `packages/discord/test/commands.test.ts` | 1.1 | 1.1 |
| 127 | `packages/discord/test/media.test.ts` | 1.1 | 1.0 |
| 128 | `test/job-home.test.ts` | 1.1 | 3.2 |
| 129 | `packages/github/test/fake-shapes.test.ts` | 1.0 | 0.7 |
| 130 | `packages/docker/test/docker-options.test.ts` | 1.0 | 0.6 |
| 131 | `packages/telegram/test/media.test.ts` | 1.0 | 2.7 |
| 132 | `packages/core/test/host.test.ts` | 1.0 | 0.8 |
| 133 | `packages/projects/test/init.test.ts` | 1.0 | 0.8 |
| 134 | `packages/dokploy/test/fake-shapes.test.ts` | 1.0 | 0.8 |
| 135 | `test/github-annotations.test.ts` | 0.9 | 0.6 |
| 136 | `packages/discord/test/fake-shapes.test.ts` | 0.9 | 0.8 |
| 137 | `packages/core/test/umask.test.ts` | 0.9 | 0.9 |
| 138 | `packages/orchestration/test/voice-reply.test.ts` | 0.8 | 1.3 |
| 139 | `packages/telegram/test/commands.test.ts` | 0.8 | 0.7 |
| 140 | `packages/findings/test/on-merge.test.ts` | 0.8 | 0.6 |
| 141 | `packages/manage/test/cleanup.test.ts` | 0.8 | 0.6 |
| 142 | `packages/core/test/config.test.ts` | 0.8 | 0.6 |
| 143 | `packages/uptime/test/uptime-options.test.ts` | 0.7 | 0.5 |
| 144 | `packages/resources/test/resources.test.ts` | 0.7 | 0.5 |
| 145 | `packages/activity/test/log-command.test.ts` | 0.7 | 0.5 |
| 146 | `packages/findings/test/findings-options.test.ts` | 0.7 | 0.5 |
| 147 | `test/option-tables.test.ts` | 0.7 | 0.4 |
| 148 | `packages/core/test/actor.test.ts` | 0.7 | 0.5 |
| 149 | `test/readme.test.ts` | 0.7 | 0.4 |
| 150 | `packages/orchestration/test/project-routing.test.ts` | 0.7 | 1.5 |
| 151 | `packages/orchestration/test/autopilot.test.ts` | 0.7 | 0.5 |
| 152 | `packages/core/test/plugin-range.test.ts` | 0.7 | 0.5 |
| 153 | `packages/stats/test/stats.test.ts` | 0.6 | 0.4 |
| 154 | `packages/core/test/commands.test.ts` | 0.6 | 0.5 |
| 155 | `packages/delivery/test/review-wake.test.ts` | 0.6 | 0.5 |
| 156 | `packages/core/test/shell-braces.test.ts` | 0.6 | 0.5 |
| 157 | `packages/telegram/test/fake-shapes.test.ts` | 0.6 | 0.3 |
| 158 | `packages/core/test/env-guard.test.ts` | 0.6 | 0.4 |
| 159 | `packages/session/test/handoff-extension.test.ts` | 0.6 | 4.3 |
| 160 | `packages/orchestration/test/inbox.test.ts` | 0.6 | 0.4 |
| 161 | `packages/activity/test/activity.test.ts` | 0.6 | 0.4 |
| 162 | `packages/core/test/clock.test.ts` | 0.6 | 0.5 |
| 163 | `test/arthur-criteria.test.ts` | 0.6 | 0.4 |
| 164 | `packages/dokploy/test/dokploy-options.test.ts` | 0.6 | 0.5 |
| 165 | `packages/core/test/env.test.ts` | 0.6 | 0.4 |
| 166 | `packages/orchestration/test/inbox-start.test.ts` | 0.6 | 0.4 |
| 167 | `packages/core/test/inside-job.test.ts` | 0.6 | 0.4 |
| 168 | `packages/activity/test/day-files.test.ts` | 0.6 | 0.4 |
| 169 | `packages/youtrack/test/fake-shapes.test.ts` | 0.6 | 0.3 |
| 170 | `packages/orchestration/test/morning-report.test.ts` | 0.6 | 0.3 |
| 171 | `packages/orchestration/test/hand-over.test.ts` | 0.6 | 0.3 |
| 172 | `packages/core/test/parts.test.ts` | 0.6 | 0.4 |
| 173 | `packages/core/test/run-record.test.ts` | 0.5 | 0.4 |
| 174 | `packages/activity/test/activity-line.test.ts` | 0.5 | 0.3 |
| 175 | `test/structure.test.ts` | 0.5 | 0.3 |
| 176 | `packages/projects/test/project-options.test.ts` | 0.5 | 0.3 |
| 177 | `packages/core/test/runner.test.ts` | 0.5 | 0.4 |
| 178 | `packages/stats/test/spend.test.ts` | 0.5 | 0.3 |
| 179 | `packages/orchestration/test/options.test.ts` | 0.5 | 0.3 |
| 180 | `packages/orchestration/test/actor.test.ts` | 0.5 | 0.3 |
| 181 | `packages/stats/test/tickets.test.ts` | 0.5 | 0.3 |
| 182 | `packages/machines/test/machine-options.test.ts` | 0.5 | 0.3 |
| 183 | `test/cpus.test.ts` | 0.4 | 0.3 |
| 184 | `packages/manage/test/manage-options.test.ts` | 0.4 | 0.3 |
| 185 | `test/ticket-kinds.test.ts` | 0.4 | 0.2 |
| 186 | `packages/github/test/github-options.test.ts` | 0.4 | 0.2 |
| 187 | `packages/core/test/ticket-command.test.ts` | 0.4 | 0.3 |
| 188 | `test/plugin-api.test.ts` | 0.4 | 0.2 |

## Appendix: the tracer

Built with `gcc -O2 -o trace trace.c`, run as `./trace <log> npm test` from the worktree's root. It needs `kernel.yama.ptrace_scope` at 0 or 1 (it traces its own descendants) and assumes no test sends SIGSTOP (none in `packages/` or `test/` does).

```c
// Process census for AR0719: runs a command under ptrace, following every fork, clone and exec, and logs
//   E <tgid> <parent tgid> <argv joined by \x1f>   at each exec
//   X <tgid> <tid> <ns>                             at each thread exit: the on-CPU ns of every live thread of the group (schedstat)
//   F <child pid> <parent tgid>                     at each fork or vfork
// No syscall is stopped, only fork/clone/exec/exit events, so the overhead is a stop per thread start and end.
#define _GNU_SOURCE
#include <dirent.h>
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ptrace.h>
#include <sys/wait.h>
#include <unistd.h>

static FILE *out;

static long field(int pid, const char *key) {
	char path[64], line[256];
	snprintf(path, sizeof path, "/proc/%d/status", pid);
	FILE *f = fopen(path, "r");
	if (!f) return -1;
	long value = -1;
	size_t n = strlen(key);
	while (fgets(line, sizeof line, f))
		if (!strncmp(line, key, n)) { value = atol(line + n); break; }
	fclose(f);
	return value;
}

static void exec_line(int pid) {
	char path[64], buf[4096];
	snprintf(path, sizeof path, "/proc/%d/cmdline", pid);
	FILE *f = fopen(path, "r");
	size_t n = f ? fread(buf, 1, sizeof buf - 1, f) : 0;
	if (f) fclose(f);
	for (size_t i = 0; i < n; i++) if (buf[i] == 0) buf[i] = 0x1f; else if (buf[i] == '\n') buf[i] = ' ';
	buf[n] = 0;
	fprintf(out, "E %d %ld %s\n", pid, field(pid, "PPid:"), buf);
}

// Every live thread's ns, so threads a group exit kills without an exit stop of their own are counted too.
static void exit_line(int tid) {
	long tgid = field(tid, "Tgid:");
	char path[96];
	snprintf(path, sizeof path, "/proc/%ld/task", tgid);
	DIR *dir = opendir(path);
	if (!dir) return;
	struct dirent *entry;
	while ((entry = readdir(dir))) {
		if (entry->d_name[0] == '.') continue;
		snprintf(path, sizeof path, "/proc/%ld/task/%s/schedstat", tgid, entry->d_name);
		FILE *f = fopen(path, "r");
		unsigned long long ns;
		if (f && fscanf(f, "%llu", &ns) == 1) fprintf(out, "X %ld %s %llu\n", tgid, entry->d_name, ns);
		if (f) fclose(f);
	}
	closedir(dir);
}

int main(int argc, char **argv) {
	out = fopen(argv[1], "w");
	int root = fork();
	if (root == 0) {
		ptrace(PTRACE_TRACEME, 0, 0, 0);
		raise(SIGSTOP);
		execvp(argv[2], argv + 2);
		_exit(127);
	}
	int status, code = 0;
	waitpid(root, &status, 0);
	ptrace(PTRACE_SETOPTIONS, root, 0, PTRACE_O_TRACEFORK | PTRACE_O_TRACEVFORK | PTRACE_O_TRACECLONE | PTRACE_O_TRACEEXEC | PTRACE_O_TRACEEXIT);
	ptrace(PTRACE_CONT, root, 0, 0);
	for (;;) {
		int pid = waitpid(-1, &status, __WALL);
		if (pid < 0) break;
		if (WIFEXITED(status) || WIFSIGNALED(status)) {
			if (pid == root) { code = WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status); break; }
			continue;
		}
		int sig = WSTOPSIG(status), event = status >> 16;
		if (event == PTRACE_EVENT_EXEC) exec_line(pid);
		if (event == PTRACE_EVENT_EXIT) exit_line(pid);
		if (event == PTRACE_EVENT_FORK || event == PTRACE_EVENT_VFORK) {
			unsigned long child;
			ptrace(PTRACE_GETEVENTMSG, pid, 0, &child);
			fprintf(out, "F %lu %ld\n", child, field(pid, "Tgid:"));
		}
		// A new tracee's first stop is SIGSTOP; no test sends SIGSTOP, so it is never passed on.
		ptrace(PTRACE_CONT, pid, 0, event || sig == SIGSTOP || sig == SIGTRAP ? 0 : sig);
	}
	fclose(out);
	return code;
}
```

The log is read in order: an `F` line starts a new process (a reused pid included), an `E` line names what it runs, each `X` line keeps the highest count seen per thread, and a process's CPU is the sum over its threads.
