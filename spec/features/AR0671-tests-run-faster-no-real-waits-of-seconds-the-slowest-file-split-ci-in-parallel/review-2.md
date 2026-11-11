# AR0671 - Review 2

- Job: 2026-11-11-review-a9232f39
- Branch: arthur/2026-11-10-worker-4b7cab02
- Commit reviewed: a2e322fad500c95c982f284876532ec4c1761b32
- Verdict: FAIL

## Final message

The worker's two new commits fix both findings from review 1. But the rewritten rate-limit test is racy, and that race fails `npm test` on the tip, so this review fails.

## Findings

1. **`packages/github/test/github.test.ts:358-359`: the rate-limit test can hang, and it did in my `npm test` run.**
   - **The race:** the test waits for `api.count(PATH) === 2`, which counts the 429 as soon as the fake server receives it. It then moves the fake clock with `at(reset * 1000 + 1999)` straight away.
   - **Why that hangs:** `waitUntil` in `github-api.ts:106` computes `retry-after` as `Date.now() + 2000` when the client reads the reply. If the client reads it after the clock moved, the pause ends at `reset*1000 + 3999`. `at(reset * 1000 + 2000)` never reaches that, so the third request never comes.
   - **Why it costs 60 s:** `until` (`packages/core/src/until.ts:6,9`) takes its deadline from `Date.now()`, which this test fakes and freezes. So it never gives up. The test runs into its 60 s timeout and reports `test timed out after 60000ms` instead of naming the condition it waited for.
   - **Evidence:**
     - The full `npm test` on a2e322fa gave 1677 pass, 0 fail and **1 cancelled**: this test.
     - 12 copies of the test run at once on 3 cores: 9 passed, 3 timed out.
     - A throwaway edit made `fake-github.ts` answer a 429 300 ms late. The test then hung every time. Restored with `git checkout`.
   - **Possible fix:** wait for proof that the client handled the 429 before moving the clock. Two of `tool`'s polls would do it, since one loop polls the projects in turn.
   - This breaks the Done-means point "`npm test` … pass on the clean tip". It also adds a flaky 60 s test to every job and CI shard.

## Notes
- (risk) `packages/session/test/compaction.test.ts:40`: adds to F5: 3899 ms alone here, at a load of 12. Each of its 4 cases still waits for the handoff extension's settle time (`SETTLE_MS`, 4 ticks). So part of the time may be a wait, not agent start-up [INFERENCE].
- (minor) `packages/session/src/handoff-extension.ts:22-24`: the comment still ties `SETTLE_MS` to the inbox's handover (1 s plus its 500 ms tick). The code now makes it 4 session ticks: 400 ms in tests, below the 1.5 s the comment says it must exceed.
- (minor) `packages/delivery/test/merge-steps.test.ts:136-149`: on a busy host the pid file may be missing. That run then skips `running(pid)`, so it does not test the "ignores SIGTERM" kill.
- (minor) `packages/session/src/handoff-extension.ts:20`, `session.ts:39`, `packages/uptime/src/site-check.ts:20`, `uptime.ts:22`: mutate survivors, as the worker reported. Reverting the first three brings back the real 500 ms / 1 s timings, and no test notices. The fourth only restores a constant nothing uses.

## Checks (on a2e322fa)
- **`npm run check`:** passed.
- **`npm test`:** 1677 pass, 0 fail, 1 cancelled (the rate-limit test, `timed out after 60000ms`), 64 skipped. 649.9 s wall, user 1264 s, sys 547 s; load 0.34 at the start.
- **Rate-limit test alone, 5 times:** all pass, 1.87–2.10 s each.
- **Whole `github.test.ts` alone, 3 times:** 24 of 24 pass each time.
- **Rate-limit test, 12 copies at once:** 9 pass (4.4–5.6 s), 3 cancelled at 60 s.
- **Hand mutation:** a 300 ms delay on the fake's 429 replies made the test hang (cancelled at 60 s). Restored; `git status` clean.
- **`npm run mutate`:** 19 mutants, 14 caught, 5 survived (listed in Notes), 6 not run (time). Not rerun.
- **Session package, each test's duration from the TAP output:** the only tests over 2.5 s were "a handoff write that fails…" at 3899 ms, "no LLM access" at 2897 ms and "busy for compactWaitSeconds" at 2518 ms.
- **`merge.stepSeconds` test alone:** passed, 2197 ms.
- **Shard check:** I ran the four `--test-shard=i/4` runs with a name pattern that matches no test, so each run only loads its files. They loaded 44, 44, 44 and 43 files, 175 together. That is as many as one run with no shard flag, so the shards cover every file. `ci.yml` uses the same globs as `package.json`'s test script.

FAIL