# AR0718 - Review 1

- Job: 2026-11-17-review-cf4f28c9
- Branch: arthur/2026-11-17-worker-49b51da7
- Commit reviewed: 187e41a70a7ce2b2991bc4cdd6992fa823d548ef
- Verdict: PASS

## Final message

No blocking findings. The branch meets every Done means point of AR0718:

- **Timings:** `report.md` has three default runs and three runs at concurrency 3, all on `7a418f2b`. Each run lists its wall time, user and sys CPU, pass and fail counts, and the load before and after.
- **Result:** concurrency 3 was faster on the mean, 637 s against 731 s, and failed no test that the default passed.
- **CPU count:** the `test` script reads the count from `test/cpus.ts`, never a fixed 3. That file takes the tightest cgroup v2 `cpu.max` of the process's cgroup and every cgroup above it, rounded down and never below 1. With no limit it falls back to `os.availableParallelism()`.
- **Scope:** CI's workflow is unchanged, as the Scope's Out says.
- **Mutations:** 23 mutants, all caught, so every key behavior of `cpus.ts` has a test that fails without it.
- **Worker's claims:** every number in the final message that I could re-run matched: the CPU count of 3, the test counts and run time, and the mutation counts.

## Notes
- (risk) packages/herdr/test/fake-herdr.ts:132: adds to F1. It is not limited to default concurrency. My first `npm test` on `187e41a7`, at `--test-concurrency=3`, failed the same way: `ENOENT` on the rename at `herdr.test.ts:74` (`seed`). So F1's flake also hits the new default that this branch sets. The file passed 3 of 3 runs alone, and my second full run passed.
- (minor) test/cpus.ts:5-6: the comment says Node's default "ignores a cgroup's cpu.max". In this job `availableParallelism()` prints 11 on 12 cores, which equals the jobs slice's `1100000 100000`. So libuv does read a `cpu.max`, just not the job scope's 3. The reason for the change still holds.
- (minor) test/cpus.test.ts: this is a second new file under `test/`, and the Scope allows "at most one". It is the test the review criteria require for the new behavior, but the final message gives no reason for it.
- (minor) package.json:16: `$(...)` needs a POSIX shell, and npm on Windows runs scripts with `cmd.exe`. An empty value makes `node --test` exit 9 (I tried `--test-concurrency=`). This only matters if `cpus.ts` prints nothing, and its `read` catches every read error.

## Checks (all on 187e41a7, in this checkout)
- `npm run mutate`, first call: 20 mutants, 20 caught, 0 survived; 3 not run (time). Second call: 23 mutants, 23 caught, 0 survived.
- `npm run check` (`tsc`): no errors.
- `npm test`, first run: 1 failure, the herdr F1 `ENOENT` above, in 634.5 s. I cut that run's output with `tail`, so I have no counts for it.
- `node --import @arthur/core/testing --test packages/herdr/test/herdr.test.ts`, alone, 3 times: 11 tests, 11 pass, 0 fail each time. The diff does not touch this file and it passes alone, so under verify.md step 2 the failure does not count against the branch.
- `npm test`, second run: 1889 tests, 1825 pass, 0 fail, 64 skipped, `duration_ms` 631636.
- CPU facts in this job: `nproc --all` 12, `availableParallelism()` 11; scope `cpu.max` `300000 100000`, jobs slice `1100000 100000`; `node test/cpus.ts` prints 3.
- `node --test --test-concurrency= test/cpus.test.ts`: exit 9.

PASS