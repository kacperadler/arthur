# AR0487 - Findings

## F1. A job's session also gets an `@<path>` from its input attached

- Kind: security
- Found by: 2026-10-27-review-598f0d3c (review), 2026-10-27
- Where: the reviewer's own session
- What: the reviewer reported the content of a system file attached to its session, from an `@<path>` in text it was given (the worker's message); the same expansion the coordinator saw (AR0532), here inside a job's sandbox.
- Status: ticket AR0532 (its worker is told to check the job side too)

## F2. The new test checks only the last two arguments

- Kind: test
- Found by: 2026-10-27-review-598f0d3c (review), 2026-10-27
- Where: `packages/core/test/job-control.test.ts:355`
- What: the continue-in-place test checks the whole list, so together they cover it.
- Status: dropped (covered by the other test)
