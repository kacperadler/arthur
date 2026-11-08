# AR0656 - Review 1

- Job: 2026-11-08-review-03f1f51c
- Branch: arthur/2026-11-08-worker-2ea1125b
- Commit reviewed: ca5e90d6b397bc9ccf6cdfd186c987e69069544a
- Verdict: PASS

## Final message

I found no blocking issues. The branch delivers the ticket end to end: when a worker's run ends, the `session_stop` handler in `checks-extension.ts` checks the tip with `untested`, the same function `arthur review` uses to refuse a tip. If something is missing, it sends one `[Arthur] Before your run ends` reminder naming what; it stays quiet for a passing tip, for other kinds of job, and on the run's second end. Each of those cases has a test, and the tests fail when the behavior is removed.

The worker departed from the ticket's sketch in three places and gave a reason for each:
- It calls `untested` directly. The sketch's `gap()` does not exist.
- It reads the worktree from `ctx.cwd`, like the other handlers, instead of `process.cwd()`.
- It reads the record's `machine`, so a job on another machine gets no reminder; `arthur review` does not check those either.

Three files outside the Scope changed, each with a reason:
- **`checks.test.ts`:** the tests the Done means requires.
- **`test/structure.test.ts`:** delivery's line budget goes from 2220 to 2243. I confirmed `npm test` needs it. The raise has to show in `outcome.md`.
- **`findings.md`:** F1 and F2.

## Notes
- (risk) `packages/delivery/src/checks-extension.ts:49`: the processes reminder (AR0585) can be lost. omp keeps only the first continuation, and the checks extension is registered first (`delivery.ts:117`). When both reminders fire, the processes one is dropped, and since its `reminded` flag is already set it never comes back in that run. The ticket's design causes this and the Scope keeps the fix out; it is already F1 in `findings.md`. Nothing is lost for good: the wrapper still kills leftover processes at the job's end.
- (minor) `packages/delivery/src/checks-extension.ts:51`: builds a fake `{ folder } as Host` and a fake `JobRecord` to feed `untested`. It works because `untested` reads only `folder`, `id`, `branch` and `machine`. If `untested` ever reads another field, it gets `undefined` and the type check won't catch it.
- (minor) `packages/delivery/src/checks-extension.ts:52`: `git(...).stdout.trim()` throws if git cannot be spawned (`stdout` is null), so the handler would throw, against the file's own "none of these does" comment. Git is always present for Arthur, so this cannot happen in practice.
- (minor) F2 (no doc page mentions the reminder) is correctly logged as a finding. The Scope's Out excludes `review-needed.md` and `delivery.md`.

## Checks (on `ca5e90d6`)
- **`npm run check && npm test`:** tsc reported no errors. 1650 tests: 1586 pass, 0 fail, 64 skipped. `checks-extension.ts` is 119 lines (green). The structure test passes with the 2243 budget.
- **`npm run mutate`:** 25 mutants, 24 caught, 1 survived, 14 not run. The survivor, `checks-extension.ts:70: hunk reverted to the base`, puts back `tree()`'s old inline git command with the same flags. That is the same behavior, so no test can catch it; it is not a finding.
- **Hand mutations**, each run against `packages/delivery/test/checks.test.ts` and each caught by a failing test, then restored with `git checkout`:
  - dropped `reminded ||`: 1 fail
  - removed the `kind !== "worker"` check: 1 fail
  - hard-coded `machine` to `"local"`: 1 fail
  - removed `reminded = true`: 1 fail
  - made the handler always return `undefined`: 1 fail
  - gave `untested` a commit other than HEAD: 2 fail
  - `git status` was clean afterwards.
- **Loader:** `node` and `bun` (the runtime omp is built on) both import `checks-extension.ts` with its new `review-command.ts` import and get the default function. The import chain uses only Node built-ins plus type-only imports. Loading through omp's own loader is still untested.
- **Smoke test:** I loaded the extension with `node` as a worker job in a temporary home folder, against this checkout. The first `session_stop` returned the full reminder, `arthur/x at ca5e90d … no check, no test, no mutate. Commit your work, …`; the second returned `undefined`.

PASS