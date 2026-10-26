# AR0464 - The stop test of a forked install process fails now and then under a merge step

```json
{
  "id": "AR0464",
  "title": "The stop test of a forked install process fails now and then under a merge step",
  "date": "2026-10-26"
}
```

## Description

The merge of AR0434 on 2026-10-26 was refused and main reset because one core test failed in the merge's `npm test` step, though AR0434 touches only the orchestration package. A merge should not fail on a test that fails by timing.

## Goal

`packages/core/test/job-control.test.ts:124`, "arthur stop once the install exited, while a process it forked still holds its output, ends the job stopped and starts no agent", failed at line 138 in the sandboxed merge step: `AssertionError: the stop took what the install left too` (`true !== false`), 3880 ms. On the host the same file passed 3 runs in a row (30 pass, 0 fail each). The assertion reads `alive(forked)` right after the stop returns, so the forked `sleep` may not be reaped yet [INFERENCE], or the merge step's scope or sandbox changes how the stop reaches it.

- Kind: test

## Done means

- The test waits until the forked process is gone (with a bound) instead of reading it once, or the real cause is found and fixed; the file passes 20 runs in a row on the host and in a merge step.

## Scope

In:
- `packages/core/test/job-control.test.ts`: the test at line 124.

Out:
- Any change to the stop itself, unless the cause is there; then it is a new ticket.

## Decisions

