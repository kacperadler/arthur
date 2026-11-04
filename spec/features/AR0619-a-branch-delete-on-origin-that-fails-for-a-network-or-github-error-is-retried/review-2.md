# AR0619 - Review 2

- Job: 2026-11-04-review-71c301db
- Branch: arthur/2026-11-04-worker-05ae6245
- Commit reviewed: 2053fbe09c6daef44ba0c16565e6bcc57c05a813
- Verdict: PASS

## Final message

All three findings from review 1 are fixed. Each one now has a test that fails when the behaviour is removed, `npm run check` and `npm test` pass, and I found nothing that blocks the merge. As you said, I did not re-judge the github line budget raise from 1020 to 1076, and I did not judge CI.

## Review 1's findings
1. **A failed delete push is now retried (`github-branch.ts:110`).** The new test "a delete push git failed once origin was listed is retried…" covers two failures after a successful listing: the connection dropping, and a `[remote rejected] (503 Service Unavailable)` answer. It checks that:
   - each failure gets one "retrying" notice;
   - each record holds origin's listed tip;
   - both branches are deleted on later polls with no further notice.
   
   I replaced `return again(why) ? {…} : why;` with `return why;`: 1 test in the file fails.
2. **The 24 h limit is pinned (`github-branch.ts:34`).** One record is now 24 h + 1 s old and is given up. The other is 24 h − 60 s old and must still be retried. I set `DAY_MS` to `24 * 59 * 60 * 1000`, one of the survivors the worker did not run: 1 test fails.
3. **Each alternative in `again` is pinned (`github-branch.ts:38`).** Each server error in the table now matches exactly one alternative, and `(5000 refs)` must not be retried. I removed `|unavailable` (1 test fails), then `server error|` (1 test fails). The worker had not mutated either of these.

## Notes
- (minor) packages/github/src/github-branch.ts:85: a retry never reads the record's `tip`; it lists origin again. Done means only asks for the tip to be recorded, and the test checks it is origin's listed tip.
- (minor) packages/github/src/github-branch.ts:93: `checkConfig` runs once here and again inside `originBranches` and `deleteOnOrigin` on each try. Raised in review 1, left as is; it does not change behaviour.

## Checks (on 2053fbe0)
- `npm run check`: tsc reports no errors.
- `npm test`: exit 0; 1529 tests, 1465 pass, 0 fail, 64 skipped.
- Four hand mutations, each followed by `node --import @arthur/core/testing --test packages/github/test/github-branch.test.ts`: every one gave 9 pass, 1 fail. I restored each with `git checkout -- packages/github/src/github-branch.ts`, and `git status --short` was empty afterwards.
- I did not run `npm run mutate`, to save budget; I mutated the three findings by hand instead.

PASS