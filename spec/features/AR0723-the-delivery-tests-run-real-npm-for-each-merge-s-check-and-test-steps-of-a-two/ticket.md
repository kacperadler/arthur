# AR0723 - The delivery tests run real npm for each merge's check and test steps of a two-script project

```json
{
  "id": "AR0723",
  "title": "The delivery tests run real npm for each merge's check and test steps of a two-script project",
  "date": "2026-11-17",
  "budget": 10
}
```

## Description

Proposal P3 of AR0719's report (`spec/features/AR0719-npm-test-takes-about-12-minutes-of-3-busy-cores-find-which-test-files-and-which/report.md`, "P3. The delivery tests' projects run their checks without real npm"), measured on main `793a1927`: about 20 to 30 CPU-s (estimated: 154 npm starts used 31.1 CPU-s with the cache, 0.2 s each; a fake `npm` that runs the script's command costs a shell or a cached node start).

## Goal

- Kind: perf

a merge in a test runs `npm run check` and `npm test` of a two-script project (`packages/delivery/test/merge-setup.ts`: `node -e ""` and `node test.js`); npm itself is most of their cost.

Risk, as the report weighs it: medium. These tests no longer show that real npm finds and runs the project's `check` and `test` scripts; keep real npm where that is the point (`packages/delivery/test/merge-checks.test.ts`, which checks npm's cache folder, and one merge test).

## Done means

- a fake `npm` first on the PATH the merge's steps get, which runs the named script with `sh -c` and keeps npm's exit status and signal handling (`merge-steps.test.ts` kills a step that ignores SIGTERM); the merge outputs the tests compare stay as they are; the traced count of npm starts falls from 154 to the few kept; `npm test` passes.
- The report's numbers are rechecked on this branch before and after, and the outcome gives both.
- `npm run check` and `npm test` pass.

## Scope

In: `packages/delivery/test/merge-setup.ts`, `merge.test.ts` (35 npm starts), `merge-outcome.test.ts` (38), `merge-main.test.ts` (24), `merge-steps.test.ts` (18), `auto-merge.test.ts` (16). Out: `packages/core/test/update.test.ts` (14 starts of `npm ci`, the update's real work), `packages/delivery/src/merge-checks.ts`.

## Decisions

- 2026-11-17: Source: AR0719's report, P3.
- 2026-11-18: AR0723 approved, budget 10; the owner: "AR-D694 - merge" (AR-D694)
