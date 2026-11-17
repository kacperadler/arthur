# AR0721 - npm test compiles Arthur's TypeScript again in every Node process it starts: turn on Node's compile cache for the test run

```json
{
  "id": "AR0721",
  "title": "npm test compiles Arthur's TypeScript again in every Node process it starts: turn on Node's compile cache for the test run",
  "date": "2026-11-17",
  "budget": 10
}
```

## Description

Proposal P1 of AR0719's report (`spec/features/AR0719-npm-test-takes-about-12-minutes-of-3-busy-cores-find-which-test-files-and-which/report.md`, "P1. Node's compile cache for every process of a test run"), measured on main `793a1927`: about 490 to 640 CPU-s and 140 to 210 s wall of 1650 CPU-s and 644 s (measured).

## Goal

- Kind: perf

every Node process `npm test`, CI's shard line or `node --import @arthur/core/testing --test <file>` starts reuses compiled modules, so each start stops paying 0.27 CPU-s to compile the core (evidence: the tables above; 1650 → 1011 and 1156 CPU-s, 644 → 435 and 507 s wall, 1828 pass, 0 fail each).

Risk, as the report weighs it: low. The same code runs; only V8's compile step is skipped where a module's text is unchanged. Node checks each entry against the source and its own version [INFERENCE from Node's documentation of `module.enableCompileCache`; `test/mutate.test.ts`, which edits sources between runs, passed with the cache on]. A cache folder that cannot be written only turns the cache off. Tests check nothing less.

## Done means

- `packages/core/src/test-env.ts`, the kit's first module, calls `module.enableCompileCache(<folder>)` and sets `process.env.NODE_COMPILE_CACHE` to the same absolute folder when unset, so the test file and every child that inherits the environment use one cache; the folder is the checkout's own, e.g. `node_modules/.cache/arthur-test-compile` beside the root `package.json` (gitignored, never a production path nor a fixed `/tmp` one).
- A test fails when it is removed: a `node -e` child started with `process.env` prints `module.getCompileCacheDir()` inside that folder.
- `/usr/bin/time -f "%e %U %S" npm test` three times before and three after, on one commit, in the merge's outcome: CPU down by at least 400 s.
- The report's numbers are rechecked on this branch before and after, and the outcome gives both.
- `npm run check` and `npm test` pass.

## Scope

- In: `packages/core/src/test-env.ts`, its comment, the new test in `packages/core/test/testing.test.ts`.
- Out: production processes (an `arthur` command or a job's wrapper with the cache is a product question for the owner: a static `import` runs before the call, so `cli.ts` would need a small entry that enables the cache and then imports the rest); the runner's own process, which loads before the kit.

## Decisions

- 2026-11-17: Source: AR0719's report, P1.
