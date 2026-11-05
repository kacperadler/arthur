# AR0521 - Review 1

- Job: 2026-11-05-review-5792389f
- Branch: arthur/2026-11-05-worker-48c495a2
- Commit reviewed: 7e2a1c81bd06614496c54b4776362e69d99daa2d
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch caps the log in one `records` answer at 512 KiB, on top of the existing 256 KiB per job. Jobs are read in the order asked, and each gets what is left of the 512 KiB divided among the jobs not read yet. Every job asked moves on in each copy, and the rest comes in the next sweep. That covers every "Done means" point in the ticket. The docs (`remote-job.md`, `spawn.md`, `config.md`) and the comment in `machine-sync.ts` now describe the cap per answer, and I found no stale "per job only" wording. The worker's claimed test counts match mine exactly.

The new test in `machine.test.ts:889` fails without the change. I checked this with four mutations of `packages/core/src/remote-job.ts`, running that test alone each time. The test failed under every one, and each was restored with `git checkout`:
- removing `left -= logTo - logFrom;` (the budget never shrinks);
- setting `share = min(LOG_BYTES, left)` (no division among the jobs);
- dividing by `asked.length` in place of `asked.length - index`;
- raising `ANSWER_BYTES` to 64 MiB.

## Notes
- (risk) `packages/core/src/remote-job.ts:109`: the cap counts raw log bytes, not the size of the JSON answer. A log full of characters that need escaping (quotes, control characters, sent as `\uXXXX`) can still produce an answer several times 512 KiB. The record files other than `log` are not counted either. For typical logs the answer is well under 1 MiB, but the 20 s limit is not guaranteed in the worst case.
- (minor) `packages/core/src/remote-job.ts:109`: with a very large number of jobs asked (over about 130,000), a job's share falls below 4 bytes. A cut at a character boundary could then stop at `logFrom`, and that job would make no progress. This is not realistic.
- (minor) `packages/core/src/remote-job.ts:108`: `let [index, left] = [0, ANSWER_BYTES]` in the loop header is there to keep the core within its 7210-line budget. It reads less plainly than a separate `let left`.

## Checks (on 7e2a1c81)
- `npm run check`: tsc passed.
- `npm test`: 1552 tests, 1488 passed, 0 failed, 0 cancelled, 64 skipped. The structure test passed and listed only yellow files that this branch does not touch.
- `npm run mutate`: the full run hit the 1800 s timeout and gave no result. Afterwards `git status` was clean and no mutate process was left running. I used the four hand mutations above in its place.
- Hand mutations: 4 of 4 caught by the new test.

PASS