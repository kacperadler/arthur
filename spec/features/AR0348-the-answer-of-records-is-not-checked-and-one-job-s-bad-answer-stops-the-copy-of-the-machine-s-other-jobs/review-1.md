# AR0348 - Review 1

- Job: 2026-11-02-review-cb40e73a
- Branch: arthur/2026-11-02-worker-33f91ff1
- Commit reviewed: 488d77a5e2ec70d6741bc2a79f7871905f425f8d
- Verdict: PASS

## Final message

No finding blocks the merge. The branch does what AR0348 asks: each job's `records` answer is checked before anything of it is written, and each job is copied in its own `try`. A failure is named as `machine <name>: job <id>: <why>`, and the machine's other jobs are still copied. Both tests the ticket asks for are there:
- **Bad `since`:** the other job of the machine is still copied, and the error names the bad job.
- **Unknown `state` (`"done"`):** the answer is refused, and the bad job's record folder stays byte-for-byte unchanged, its state with it.

Each row runs in both copy orders. A last case, with both jobs bad, gives two lines with the newest job first.

As you said, I judged mutation coverage by reading the code; I did not rerun mutate. Each check in `refusal` (`packages/core/src/machine-sync.ts:42-56`) has a table row that expects its exact message. Each check also guards a later write or throw. So removing or inverting any of them either writes to the record or changes the error, and the "record unchanged" assertion or the exact-message assertion fails. Removing the per-job `try`, the `failed.push` or the final throw breaks the "other job is still copied" assertion or the error assertion. The `copy === undefined` early return is reached by the existing tests where the answer leaves a job out.

`spawn.md` is updated: the copy is per job, the shape an answer must have is listed, and the refusal messages carry the new `job <id>: ` prefix. A search of `packages`, `README.md` and `spec/roadmap.md` for the old wording ("job <id> sent", "refuses the machine's copy") finds nothing. The core budget raise from 7056 to 7079 is decided (AR-D453, AR-D63). `machine-sync.ts` is 140 lines, still green.

## Notes
- (risk) packages/core/src/machine-sync.ts:44-54: values from the other machine go into the error message without being hidden or shortened. `JSON.stringify(state)`, `reason`, `since`, `files` and the record itself are put into the sweep's error without the bus's `hide`. A secret or a very large string sent there would reach whatever prints that error. Written values, by contrast, are hidden (`hide(copy.reason)`).
- (minor) packages/core/src/machine-sync.ts:85: an answer that is JSON `null` at the top level fails at `answer[id]`, before the `try`. It stops the whole machine's copy with a `TypeError` instead of a named refusal. This is outside what the ticket lists.

## Checks
- `npm run check`: tsc passed with no errors.
- `npm test`: tests 1486, pass 1422, fail 0, skipped 64 (421 s). No timing test failed, so I did not run `limits.test.ts` alone.
- `npm run mutate`: not rerun, as instructed; coverage judged by reading the tests, as above.

PASS