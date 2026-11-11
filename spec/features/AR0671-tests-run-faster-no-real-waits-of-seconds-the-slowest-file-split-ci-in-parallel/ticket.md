# AR0671 - Tests run faster: no real waits of seconds, the slowest file split, CI in parallel shards, workers test their package first

```json
{
  "id": "AR0671",
  "title": "Tests run faster: no real waits of seconds, the slowest file split, CI in parallel shards, workers test their package first",
  "date": "2026-11-09"
}
```

## Description

`npm test` takes about 12 minutes, in CI and in every job, and a worker or review runs it several times; a merge waits for CI and then runs it again. This ticket makes the suite faster without giving a job more cores (the owner, AR-D591: keep 3 jobs with 3 cores each), so jobs, reviews and merges finish sooner.

## Goal

The owner asked on 2026-11-09 "How we can speed up tests?". Evidence, CI run 42691319094 on main (ubuntu-24.04, 2026-11-09 20:16): `npm test` 1676 tests, `duration_ms 743665` (12.4 min); the tests' own times add up to 1947 s. Measured from that run's log, by the file each test name is in:
- `packages/core/test/machine.test.ts`: 275 s in 58 tests, run one after another inside the file, so this one file holds the suite at least 4.6 min whatever the cores; then `delivery/test/merge.test.ts` 146 s, `session/test/restart.test.ts` 107 s, `orchestration/test/inbox.test.ts` 97 s, `github/test/github.test.ts` 83 s.
- 28 tests take 10 s or more, 420 s together, nearly all waiting for a real timeout to pass: "do not end within 60 s fail" (63 s), "a page 30 001 px tall is shot whole" (27 s), "a copy that does not answer within 20 s" (22 s), "a step still running at merge.stepSeconds is killed" (18 s), "a probe with no answer is cut after 10 s" (12 s), "a job over its memory cap is stopped within one 10 s sample" (11 s), "ten machines that hang cost one check of 10 s" (10 s), "a wrapper that writes no pid within 10 s is killed" (10 s).
- CI runs the whole suite in one GitHub job; the repository is public, so parallel jobs cost nothing.
- Workers run the full suite while they iterate, not only at the end (the worker role asks for `npm test`; a run is 711 s on 3 cores, AR0578).

- Plan: yes

- Kind: perf

## Done means

- A timeout a test waits for is a value the test sets short (an option, an environment variable read only under the test kit, or a constant the code takes as a parameter), never a real wait of seconds; the behaviour each test asserts stays the same, and its name keeps the production value it describes. Every test of the 28 above runs under 3 s.
- `machine.test.ts` (and any other file over 60 s after the change) is split into files of one subject each, so they run in parallel.
- CI runs `npm test` in 4 parallel shards (`node --test --test-shard=<i>/4`) and one job that needs all of them, the name `arthur ci` and delivery read; `npm test` alone still runs everything.
- The worker and the reviewer role say: while iterating, run the tests of the packages you changed (`node --import @arthur/core/testing --test "packages/<p>/test/**/*.test.ts"`); the full `npm test` once on the clean tip before ending, as now.
- Measured in the merge's outcome: `npm test` time in CI and on this server before and after; target CI under 5 min and the full suite on 3 cores under 6 min.
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip; no test is deleted or skipped to save time.

## Scope

In:
- The tests above and the source lines whose timeouts they wait for (an option or parameter, default unchanged).
- `.github/workflows/ci.yml`: the shards.
- `packages/github` and `packages/delivery`, only if they must name the shard jobs to read CI's result.
- The worker and reviewer role files: package tests while iterating.

Out:
- More cores per job or more jobs at once (AR-D591: no).
- Skipping `arthur merge`'s own `npm test` when CI passed on the same tree: not done; the owner decides that apart.

## Decisions
- 2026-11-09: AR0671 approved; its plan runs next when a slot frees, before the Docker work; the owner: "AR-D593 - 1" (AR-D593)
- 2026-11-10: Plan approved by the owner: plan.md at 7c960f32; the owner: "AR-D596 - approve" (AR-D596)
- 2026-11-10: Merge AR0671 once its review passes and CI is green; the owner: "AR-D632: 1" (AR-D632)

