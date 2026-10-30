# AR0571 - Review 1

- Job: 2026-10-30-review-997cf6cb
- Branch: arthur/2026-10-30-worker-4caae474
- Commit reviewed: 8e2ebc6d7ec0022d62639dd4656659045bbf3aa0
- Verdict: PASS

## Final message

No blocking findings: the resume runs at most once, never for a cyber refusal or a user abort, and a second failure ends the run as before. Every point in the ticket's Done means is met.

## Findings

None block the merge.

- **F1, the 20-retry window** (`packages/core/src/job-omp.yml:5-14`, the worker's finding): it is stated from omp itself. I read the omp binary and found:
  - `retry.maxRetries` defaults to 10 and `retry.baseDelayMs` to 500.
  - `XGe(e,t)` waits `min(e·2^(t-1), Vca)` times `1 − random·Xca`, with `var Vca = 8000, Xca = 0.25`.
  - Retry `n` uses `XGe(baseDelayMs, n)` until the count passes `maxRetries`.
  - 500 + 1000 + 2000 + 4000 + 16 × 8000 = 135.5 s; less the 25% jitter that is 101.6 s. The worker's figure is exact.
  - The ~19 minutes rests on the worker's own measurement against a local server answering 529 (about 11 requests and 50 s per omp retry). I did not reproduce it or find the client's retry count in the binary.
  - Harm: a job waits up to ~19 minutes, then the resumed run can wait as long again: ~38 of the default 120 minutes (`core.jobs.timeoutMinutes`). If the time limit comes first, `final` rules out the resume and the job ends `limit: time`; commits stay. It costs time, not work. That makes it a finding for the owner, not a FAIL.
- **Budget +25 against the +20 estimate** (`test/structure.test.ts:14`, 6476 → 6501): the figure is measured. `job-ending.ts` is 29 lines and `wrapper.ts` went from 200 to 196. The 5 extra lines are the typed `Ending` input of the moved ladder and three one-line why-comments. Type stripping needs the type and the styleguide asks for the comments, so none is surplus. AR-D355 allows a measured raise.

## Notes

- `packages/core/src/wrapper.ts:162`: deleting the `record.clearStop()` before the resume survives the whole `wrapper.test.ts` (32/32 pass). Without it, a run B that exits without a `message_end` would report run A's `stopped on error: …` instead of `exited N`. The job still ends `failed`, so it is not a FAIL.
- `job-ending.ts:25`: `\b5\d\d\b` matches any 3-digit number from 500 to 599 in an error, e.g. a 400 that names "512 tokens". That costs at most one extra resume.
- A run already resumed at its budget can still get this resume after a provider error, so up to three runs. It is bounded, `spawn.md` says so, and no test covers the combination.
- `delivery.ts:190`: the wake says the review was resumed "for that already" even when the one resume was for a provider error and run B then ended without a verdict. The sentence also lacks a comma before "though".
- The worker's edits outside the ticket's file list (`models.test.ts`, `models.md`, `plan.md`, `review.md`) all follow from the changed behaviour, and the worker's message gives the reasons.

## Checks run

- `npm ci`: 24 packages added.
- `npm run check && npm test` in one call: tsc clean; 1349 tests, 1274 pass, 0 fail, 75 skipped. This matches the worker's numbers, and nothing in `limits.test.ts` failed.
- Mutations, each restored with `git checkout`; the tree is clean at 8e2ebc6d:

| Mutation | Tests run | Result |
|---|---|---|
| Cyber guard dropped | `wrapper.test.ts` | the cyber row fails |
| `aborted` counted as an error | `wrapper.test.ts` | the abort row fails |
| `\b5\d\d\b` dropped | `wrapper.test.ts` | the 500 row fails |
| `connection.?error` dropped | `wrapper.test.ts` | the Connection error row fails |
| `final ?` guard dropped | `job-control.test.ts` | the stop-after-exit test fails |
| Resume allowed twice | `wrapper.test.ts` | all 7 resume rows fail, including both second-failure rows |
| No-verdict branch off | `wrapper.test.ts` + `plans.test.ts` | 2 wrapper rows and the plan-review test fail |
| `plans.ts` `verdicts` removed | `plans.test.ts` | the plan-review test fails |
| `clearStop` before the resume removed | `wrapper.test.ts` | survives (note above) |

PASS