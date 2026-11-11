# AR0687 - Review 2

- Job: 2026-11-11-review-63ff71ea
- Branch: arthur/2026-11-11-worker-bd554130
- Commit reviewed: 3cafae4424e085b9396f04aa070084a67b1d2067
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0687 asks, end to end.

- **Reminder** (`packages/delivery/src/checks-extension.ts:55-59`): when the checks ran on an older commit, the run-end reminder now adds `Your checks ran on <commit>, and your tip is now <tip>: any commit after them needs them run again.` It still asks for the scripts again on the committed tip. The test at `packages/delivery/test/checks.test.ts:313-316` checks the whole reminder text. When I removed the `ran === undefined` condition by hand, that test failed, so it does fail without the change.
- **Worker role** (`packages/core/roles/worker.md:17`): one new line says the scripts run last, on the committed tip, and nothing is committed after them. The ticket names `packages/orchestration/roles/worker.md`, which does not exist; the only worker role file is `packages/core/roles/worker.md`, and the worker said so.
- **Sandbox change** (`packages/core/src/job-sandbox.ts:116`): `hidden()` now lets a job read its own `<home>/<package>/<id>` folder, the same folders `writable()` already let it write. This goes beyond the ticket's listed scope, but the reminder cannot work without it: the old sandbox let the job write its `checks` file but not read it back. The worker explained this.
  - The sandbox test's exact list shows that only the job's own delivery folder becomes readable, no other job's.
  - `test/job-home.test.ts` passes on its own and was not skipped here. It shows a sandboxed job can read its own checks, while other plugins' state stays `Permission denied`.
  - `docs/deploy.md:39` and `packages/core/docs/commands/spawn.md:127` are updated. I found no other doc that still says what the branch changed.
- **Size and budget**:
  - `job-sandbox.ts` was already yellow at the base (215 lines as the structure test counts them) and is 216 now. It did not newly enter yellow.
  - Core's line budget goes from 7528 to 7529 and delivery's from 2243 to 2246. The worker flagged both raises for `outcome.md`.
- **Worker's claims**: every one I checked matches: test counts, mutate result and the files changed.

## Notes
- (risk) `packages/core/src/job-sandbox.ts:116`: the folders `hidden()` shows come from the record's `extensions` file, which the job's sandbox lets it write. A job that edits that file before a continue could read `<home>/<any folder>/<id>`. `writable()` already gave write access to the same paths from the same file, so this adds read access only. It still goes against AR0597's rule not to trust what the record says.
- (minor) `packages/delivery/src/checks-extension.ts:57`: the regex takes only the first `ran on <commit>, not the tip`. If check, test and mutate ran on different commits, the new sentence names only the first one.

## Checks (on 3cafae4424e085b9396f04aa070084a67b1d2067)
- `npm run check`: tsc, no errors.
- `npm test`: 1720 tests, 1656 pass, 0 fail, 64 skipped, exit 0. The structure test lists `job-sandbox.ts` as yellow at 216.
- `node --import @arthur/core/testing --test test/job-home.test.ts`: 1 pass, 0 fail, 0 skipped.
- `npm run mutate`: 24 mutants, 24 caught, 0 survived.
- Hand mutation: removing the `ran === undefined ? "" :` condition in `checks-extension.ts` made `checks.test.ts` fail 1 of 18 tests. I restored the file with `git checkout --`, and `git status --short` was then empty.

PASS