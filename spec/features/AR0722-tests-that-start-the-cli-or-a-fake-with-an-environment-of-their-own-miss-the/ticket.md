# AR0722 - Tests that start the CLI or a fake with an environment of their own miss the compile cache

```json
{
  "id": "AR0722",
  "title": "Tests that start the CLI or a fake with an environment of their own miss the compile cache",
  "date": "2026-11-17",
  "budget": 10
}
```

## Description

Proposal P2 of AR0719's report (`spec/features/AR0719-npm-test-takes-about-12-minutes-of-3-busy-cores-find-which-test-files-and-which/report.md`, "P2. The processes a test starts with an environment of its own get the cache too"), measured on main `793a1927`: about 200 to 235 CPU-s after P1 (measured on one file: `packages/core/test/cli.test.ts` alone, with the cache set, 76.8 CPU-s and 41.9 s wall as it is, 25.5 CPU-s and 21.7 s wall with the variable passed to its 5 `spawnSync` calls; all 25 tests pass in both).

## Goal

- Kind: perf

after P1, 574 CLI starts (298 of 1250 traced CPU-s) and 206 fake-agent starts (60 CPU-s) still compile everything, because the test passes `env: { PATH, XDG_CONFIG_HOME, ... }`.

Risk, as the report weighs it: low. A test that hands the CLI a bare environment checks that the CLI needs nothing else; `NODE_COMPILE_CACHE` changes no code path of Arthur's. A test that compares a child's whole environment would see one more variable: none failed in the measured file. Node drops a variable whose value is `undefined`, so a run without the cache passes nothing.

## Done means

- every `env` a test builds for a `node` child (the CLI, `wrapper.ts`, a fake) carries `NODE_COMPILE_CACHE: process.env.NODE_COMPILE_CACHE`, or the kit exports one helper that builds such an env (14 files, so it is not an abstraction before its second example);
- the traced count of CLI starts above 0.25 CPU-s falls from 574 to near 0, or `/usr/bin/time` on `packages/core/test/cli.test.ts` alone falls from about 77 to about 26 CPU-s with P1 on;
- `npm run check && npm test` pass.
- Scope, by CLI CPU of the bare starts (traced, with the cache): In: `packages/core/test/cli.test.ts` (210 starts, 106.5 s), `test/job-gate.test.ts` (64, 40.9 s), `packages/core/test/spawn.test.ts` (71, 33.9 s), `packages/core/test/doctor.test.ts` (38, 20.9 s), `packages/orchestration/test/decisions.test.ts` (24, 15.3 s), `packages/core/test/job-records.test.ts` (26, 13.2 s), `packages/core/test/run.test.ts` (27, 12.7 s), `packages/core/test/job-control.test.ts` (21, 10.5 s), `packages/core/test/config-check.test.ts`, `packages/core/test/setup.test.ts`, `packages/orchestration/test/board-commands.test.ts`, `packages/core/test/secret-names.test.ts`, `test/job-home.test.ts`, `test/piece-order.test.ts` (3.0 to 7.3 s each). Out: production code; the number of CLI starts.
- The report's numbers are rechecked on this branch before and after, and the outcome gives both.
- `npm run check` and `npm test` pass.

## Scope



Order: after AR0721 (it gives the cache P2 passes on).

## Decisions

- 2026-11-17: Source: AR0719's report, P2.
