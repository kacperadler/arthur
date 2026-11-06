# AR0649 - Review 1

- Job: 2026-11-06-review-5a99eb4d
- Branch: arthur/2026-11-06-worker-0ebaba37
- Commit reviewed: 1f1d968e24f7aefab5d6f08b9c92d2cd95d313f1
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/src/run-record.ts:19`: a mutant of the "not a JSON object reads as `{}`" refusal survives.** I removed `typeof parsed !== "object" ||` from the check, so it reads `if (parsed === null || Array.isArray(parsed)) return {};`. `job-records.test.ts` and `wrapper.test.ts` still passed: 58 pass, 0 fail.
   - **Why the tests miss it:** the only non-object scalar in the test's cases is `"7"` (`packages/core/test/job-records.test.ts:124`). `Object.entries(7)` is `[]`, so the case gives `{}` with or without the check.
   - **What the mutant breaks:** a `usage` file holding a JSON string, such as `"ab"`, reads as `{ "0": {…zeros}, "1": {…zeros} }`. That is two made-up models in `JobRecord.usage`, and `jobs.md`/`plugin-api.md` promise `{}` for it.
   - **Why it fails the branch:** this is the input check on a file a human can edit. The criteria count a refusal disabled without any test catching it as a FAIL. A string case such as `['"ab"', {}]` in the test would catch it.

2. **`packages/core/src/testing.ts:45`: two comment lines were joined to keep the file out of red.** The old lines were 182 and 126 characters, which counted as 3. The joined line is 306 characters and counts as 2.
   - The structure test now prints `testing.ts: 220 lines, yellow`. That is exactly the limit; without the join it would be 221, red, and it would need `RED_FILES` and a reason in the ticket's Decisions.
   - The styleguide's Width rule says "A longer line is never a way to stay inside either". The worker's final message names the join, but the ticket allowed `core/testing` +3. The honest options were listing the file as red with an owner Decision, or a split.

## Notes
- (minor) `packages/core/src/wrapper.ts:117`: the `usage` read is a separate `existsSync ? field : undefined` line. The same pattern already reads `cost` and the other optional files in the list at `wrapper.ts:77`, and `usage` could have joined it.
- (minor) `packages/core/docs/commands/spawn.md:83`: "At the end, every file above with its final value" now covers `usage`, which `end()` does not rewrite. It is still true in practice, because `usage` is saved after every message.

## Checks (on 1f1d968e)
- `npm run check`: tsc clean.
- `node --test test/structure.test.ts`: passes. `testing.ts` is 220 (yellow) and `wrapper.ts` is 218 (yellow), as the final message says.
- I did not rerun the full suite or the whole `npm run mutate`, as you instructed. These hand mutations each ran the tests named here and were restored with `git checkout --`; `git status` was clean afterwards:
  - **Survived:** `run-record.ts:19` without `typeof parsed !== "object"`. `job-records.test.ts` and `wrapper.test.ts`: 58 pass, 0 fail.
  - **Caught:** `wrapper.ts` `usageOf(used)` changed to `usageOf(undefined)`. The `usage keeps` test: 1 fail.
  - **Caught:** `wrapper.ts` reading `field("usage")` without the `existsSync` check. `job-control.test.ts` and `wrapper.test.ts`: 3 pass, 65 fail.
  - **Caught:** `agent-stream.ts` `cacheWrite` taken from `usage?.cacheRead`. The `usage keeps` test: 1 fail.
  - **Caught:** `run-record.ts` adding `0` instead of `1` to `messages`. The `usage keeps` test: 1 fail.
- The worker's two hand mutations target code the tests do cover: `Array.isArray` is reached by the `[{"input": 1}]` case, and `"usage"` in `RUN` by the `machine.test.ts` assertion. I did not rerun them.
- AR-D529 in the ticket's Decisions covers the change to the frozen API.

FAIL