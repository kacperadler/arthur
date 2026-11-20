# AR0733 - The full check's output is read whole, never filtered

```json
{
  "id": "AR0733",
  "title": "The full check's output is read whole, never filtered",
  "date": "2026-11-20"
}
```

## Description

The verify criteria tell workers and reviewers to read the full check's output whole, never through `grep`, `tail` or `head`, so no job spends a second 12-minute `npm test` to get back the counts its filter dropped.

## Goal

three review jobs each spent an extra `npm test` (about 12 minutes on 3 cores) to get back counts their own filter threw away. Code cannot hold this: the checks extension takes pass or fail from the exit status, and a filter that keeps the summary is harmless, so refusing every pipe would refuse good calls. The reviewer and the worker read this step before their full run.

Evidence:
- AR0699 review-1.md, checks: "My first run of `npm run check && npm test` gave its counts to a grep that dropped them", so `npm test` was run a second time.
- AR0699 review-2.md, checks: "its counts were lost to a grep", so the second run.
- AR0699 review-3.md, checks: "my grep dropped its counts; these counts are from a second run".

- Kind: docs

## Done means

- Step 1 of `.agents/arthur/criteria/verify.md` reads as the After in Scope.
- `npm run check && npm test` pass (the criteria tests included).

## Scope

In:
- `.agents/arthur/criteria/verify.md`, step 1

Before:
> 1. Checks: while you iterate, the tests of each package you changed, `node --import @arthur/core/testing --test "packages/<p>/test/**/*.test.ts"` (the root's own: `node --import @arthur/core/testing --test "test/**/*.test.ts"`). Once, on the clean, committed tip: `npm run check && npm test` in one bash call with a `timeout` of 1800 seconds. Wait for it; write nothing from memory.

After:
> 1. Checks: while you iterate, the tests of each package you changed, `node --import @arthur/core/testing --test "packages/<p>/test/**/*.test.ts"` (the root's own: `node --import @arthur/core/testing --test "test/**/*.test.ts"`). Once, on the clean, committed tip: `npm run check && npm test` in one bash call with a `timeout` of 1800 seconds, its output whole: no `| grep`, `| tail` or `| head`, since the counts are in its last lines and a run that lost them costs a second full run. Wait for it; write nothing from memory.

Out:
- Any other role, criteria or script change of the retro: its own ticket.

## Decisions

- 2026-11-20: Source: retro spec/retro/2026-11-20.md
