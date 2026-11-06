# AR0649 - Review 2

- Job: 2026-11-06-review-12ed305c
- Branch: arthur/2026-11-06-worker-0ebaba37
- Commit reviewed: 5c12398a8b1a382a96d05f81268a5d46cc61dd11
- Verdict: PASS

## Final message

No blocking findings. The branch does everything ticket AR0649 asks and everything the AR0480 plan lists for S2 / roadmap entry 108:

- **Reading the tokens:** `agent-stream.ts` now reads each message's `input`, `output`, `cacheRead`, `cacheWrite` and its `<provider>/<model>`.
- **Keeping them:** `run-record.ts` keeps `usage` per model and saves it after each message. It starts from what the record already holds (`wrapper.ts`), so a continued job keeps adding up.
- **Showing them to plugins:** `job-records.ts` adds `JobRecord.usage`, which is `{}` when the file is missing or broken.
- **Other machines:** `machine-sync.ts` adds `usage` to `RUN`, so it is copied like the run's other files.
- **Fake agent:** a message step now takes `usage` and `model`.
- **Docs:** `docs/plugin-api.md` records the change to the frozen API under the ticket's Decision AR-D529. `spawn.md` and `jobs.md` are updated.

The plan's "How to test" lines for 108 each have a test:
- usage adding up over a `continue` and kept current while the job runs (`job-control.test.ts`);
- a broken or non-object `usage` file reading as `{}` (`job-records.test.ts`);
- the copy from another machine (`machine.test.ts`).

The previous FAIL's two findings are fixed:
- **`usageOf` mutant:** the `"ab"` and `true` cases now catch removing `typeof parsed !== "object"`; I re-ran that mutant and it fails the test.
- **`testing.ts` types:** the fake agent's types and their comment are moved whole into `fake-agent.ts`, and `testing.ts` re-exports them.

**Budgets:** core goes from 7239 to 7273 (+34; the plan said about +30). core/testing goes from 403 to 405 (+2; the plan said +3).

**File sizes** (counted by width): `wrapper.ts` goes from 217 to 218. It was already yellow and stays under the plan's 220 limit. `testing.ts` drops from 220 to 196. `fake-agent.ts` goes from 155 to 181.

## Notes
- (minor) task: the worker's final message is "None", so the new budget numbers aren't in it as the ticket's Done means asks. You say delivery records them; the numbers are above.
- (minor) packages/core/test/machine.test.ts:1112: the test "every file of the run is copied" does not list `usage` in `run`. This line is outside the range, and the copy is covered by the new assertion at :120.
- (minor) packages/core/src/agent-stream.ts:80: a message with no `provider` or `model` is counted under the key `"/"`. The docs don't say so.
- (minor) packages/core/src/job-records.ts:13: the `run-record.ts` import sits before `process-table.ts`, out of the file's alphabetical order.

## Checks (all on 5c12398a)
- I did not re-run `npm run check`, `npm test` or `npm run mutate`, as you asked. You report they pass on 5c12398a and CI is green; I did not see those runs myself.
- Targeted tests: `node --import @arthur/core/testing --test --test-name-pattern="usage|copies its record"` on `job-control.test.ts`, `job-records.test.ts` and `machine.test.ts`: 6 tests, 6 pass, 0 fail.
- Hand mutants, one at a time; each was caught (the test fails) and was restored with `git checkout --`:
  - `wrapper.ts`: `usageOf(used)` changed to `usageOf(undefined)`. Caught: 1 fail.
  - `agent-stream.ts`: the model key without its provider. Caught: 2 fail.
  - `machine-sync.ts`: `usage` removed from `RUN`. Caught: 1 fail.
  - `run-record.ts`: messages counted as 0 instead of 1. Caught: 1 fail.
  - `agent-stream.ts`: `cacheWrite` reads `cacheRead`. Caught: 1 fail.
  - `agent-stream.ts`: `count` without `Number.isFinite`. Caught: 1 fail.
  - `run-record.ts`: `Array.isArray` check removed. Caught: 1 fail.
  - `run-record.ts`: `typeof parsed !== "object"` check removed. Caught: 1 fail.
- `git status --short` at the end: clean, HEAD is 5c12398a.

PASS