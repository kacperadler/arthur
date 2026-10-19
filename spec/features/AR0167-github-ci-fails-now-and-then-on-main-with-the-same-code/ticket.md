# AR0167 - GitHub CI fails now and then on main with the same code

```json
{
  "id": "AR0167",
  "title": "GitHub CI fails now and then on main with the same code",
  "date": "2026-10-19"
}
```

## Description

Since about 23:30 on 2026-10-18 the `ci` workflow on GitHub fails on some commits and passes on others with the same code: main d471d59 and 904a0a5 failed, ca0184d and 03eda94 (spec-only after them) passed; main e801e88 and 0ac1e99 failed; branches 8d611ec (AR0163), ed98f4b and 8a06308 (AR0159), 5c1e954 (AR0166) failed while every local `npm test` and every review ran green (540 to 553 tests). The coordinator cannot read the job logs (no token), only the run conclusions through the public API. The flake appeared around the merges of AR0158 (schedule, 10 s sweep), AR0153 (restart guard) and AR0157 (start notice, 60 s probe, 500 ms tick).

## Goal

`ci` passes on every commit whose code passes, so a red CI again means a real failure and merges stop waiting on reruns.

- Kind: bug

## Done means

- The failing test or tests are named, with how they were found: the suite run many times under a load like GitHub's 2-core `ubuntu-latest` (for example `taskset -c 0,1` and several parallel runs), or the job logs if a token is available.
- Each is fixed at its cause, by the styleguide's rule for asynchronous tests: wait until the very state asserted holds, deadlines sized for a slow runner, a gap held open instead of raced; no retry wrapper, no skip.
- The same stress run passes 30 times in a row after the fix, where it failed before.
- `npm test` and `npm run check` pass.

## Scope

In:
- The tests that fail and, only if the cause is there, the code they test.

## Decisions

- 2026-10-19: Coordinator, during the owner's night plan: red CI on unchanged code blocks the night's merges; fixing it comes before the next roadmap entry.
- 2026-10-19: The owner: do not wait, go on; keep the tests from failing. Coordinator: merge on the evidence above after a short review of it.
