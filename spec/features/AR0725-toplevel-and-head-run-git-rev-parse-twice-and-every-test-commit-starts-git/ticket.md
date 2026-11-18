# AR0725 - topLevel and head run git rev-parse twice, and every test commit starts git maintenance

```json
{
  "id": "AR0725",
  "title": "topLevel and head run git rev-parse twice, and every test commit starts git maintenance",
  "date": "2026-11-17",
  "budget": 10
}
```

## Description

Proposal P5 of AR0719's report (`spec/features/AR0719-npm-test-takes-about-12-minutes-of-3-busy-cores-find-which-test-files-and-which/report.md`, "P5. Fewer git processes: one call where the core asks twice, no auto maintenance in tests"), measured on main `793a1927`: about 15 CPU-s (estimated: about 3,200 `rev-parse` processes at 3.3 ms and 2,351 `git maintenance` processes at 2.4 ms in the traced run).

## Goal

- Kind: perf

`topLevel` and `head` in `packages/core/src/git.ts` run `git rev-parse` once for the exit status (`yes`) and again for the output (`git`): 4,331 `--show-toplevel` and 2,034 `HEAD^{commit}` calls in the suite. Every test commit also starts `git maintenance run --auto`.

Risk, as the report weighs it: low. `topLevel` and `head` keep their answers; the kit's git config gains `maintenance.auto = false`, and no test checks Git's own maintenance. The production part (`git.ts`) also saves a git process each time a job or command asks.

## Done means

- each of `topLevel` and `head` makes one `spawnSync` and reads both its status and its output; their tests (outside Git, a repository without commits, a name that is no commit) still pass; `packages/core/src/test-env.ts` writes `[maintenance]\n\tauto = false` into the kit's git config; the traced git count falls by at least 5,000.
- The report's numbers are rechecked on this branch before and after, and the outcome gives both.
- `npm run check` and `npm test` pass.

## Scope

In: `packages/core/src/git.ts`, `packages/core/src/test-env.ts`, their tests. Out: the delivery and job code's other git calls.

Order: after AR0721 (both edit `packages/core/src/test-env.ts`).

## Decisions

- 2026-11-17: Source: AR0719's report, P5.
- 2026-11-18: AR0725 approved, budget 10; the owner: "AR-D696 - merge" (AR-D696)
