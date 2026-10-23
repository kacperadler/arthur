# AR0289 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. core job-control test can fail with ENOENT unlinking continuing under load

- Kind: bug
- Found by: 2026-10-22-review-ar0289-f7653cb3 (review), 2026-10-22
- Where: `packages/core/test/job-control.test.ts`, `packages/core/src/lock.ts`
- What: one full `npm test` failed in job-control.test.ts with `ENOENT: ... unlink '.../continuing'` in `lock.ts`; the file alone passed 3/3 and the next full run passed 1030/1030. Untouched by this branch.
- Suggestion: find which unlink of `continuing` races under load and make the test (or lock.ts, if it is the code) deterministic.
- Status: ticket AR0301
