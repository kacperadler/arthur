# AR0724 - The fake docker loads the whole core for one function, in each of its 609 starts

```json
{
  "id": "AR0724",
  "title": "The fake docker loads the whole core for one function, in each of its 609 starts",
  "date": "2026-11-17",
  "budget": 10
}
```

## Description

Proposal P4 of AR0719's report (`spec/features/AR0719-npm-test-takes-about-12-minutes-of-3-busy-cores-find-which-test-files-and-which/report.md`, "P4. The fake docker stops loading the whole core"), measured on main `793a1927`: about 20 CPU-s after P1, about 120 CPU-s without it (estimated: 609 starts; `import "@arthur/core"` costs 0.224 CPU-s cold and 0.053 warm, against 0.02 for a bare start).

## Goal

- Kind: perf

`packages/docker/test/sweep.test.ts` (100.6 CPU-s alone, 2nd) and `cleanup.test.ts` (55.1, 7th) spend 142 of their 156 CPU-s in the fake docker, one node process per `docker` or `ssh` call.

Risk, as the report weighs it: low. The fake docker uses one function of the core, `memoryBytes`, to read `--max-used-space`; `@arthur/core`'s main export is `config.ts`, which loads most of the core.

## Done means

- `packages/docker/test/fake-docker.ts` imports only what it uses through a published export that loads no more than `packages/core/src/job-memory.ts` (a new subpath export of `@arthur/core`), or parses the size itself; `docker-shapes.json` answers stay the same; `/usr/bin/time` on `sweep.test.ts` alone falls by at least 60 CPU-s without P1; the docker tests and `packages/docker/test/fake-shapes.test.ts` pass.
- The report's numbers are rechecked on this branch before and after, and the outcome gives both.
- `npm run check` and `npm test` pass.

## Scope

In: `packages/docker/test/fake-docker.ts`, `packages/core/package.json` if a subpath is added. Out: the number of docker calls a test makes.

## Decisions

- 2026-11-17: Source: AR0719's report, P4.
- 2026-11-18: AR0724 approved, budget 10; the owner: "AR-D695 - merge" (AR-D695)
- 2026-11-18: AR0724 Done means takes the measured fall (19.2 CPU-s for sweep.test.ts, 83.0 to 63.8) in place of the 60 CPU-s threshold; the owner: "AR-D699 - accept" (AR-D699)
