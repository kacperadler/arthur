# AR0301 - core job-control test can fail with ENOENT unlinking continuing under load

```json
{
  "id": "AR0301",
  "title": "core job-control test can fail with ENOENT unlinking continuing under load",
  "date": "2026-10-22"
}
```

## Description

One full `npm test` failed in `packages/core/test/job-control.test.ts` with `ENOENT: ... unlink '.../continuing'` in `lock.ts`; alone it passed 3/3 and the next full run 1030/1030 (review of AR0289's merge, 2026-10-22).

## Goal

The job-control test passes in every full `npm test` under load: the race on unlinking `continuing` is found and closed, in the test or in `lock.ts` if the code is at fault.

- Kind: bug

Evidence:
- `packages/core/test/job-control.test.ts`, `packages/core/src/lock.ts`
- Found by: 2026-10-22-review-ar0289-f7653cb3 (review), 2026-10-22

## Done means

- The cause is named and reproduced (for example by holding the gap open), and the fixed test passes with that reproduction in place.
- `npm test` and `npm run check` pass. The structure test holds.

## Scope

In:
- `packages/core/test/job-control.test.ts`, and `packages/core/src/lock.ts` only if the race is in the code.

Out:
- Other flaky tests.

## Decisions

- 2026-10-22: Source: F1 of AR0289
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
