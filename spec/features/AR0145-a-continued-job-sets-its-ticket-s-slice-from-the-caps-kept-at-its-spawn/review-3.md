# AR0145 - Review 3

- Job: 2026-10-19-review-ar0145-resources-c2056861
- Branch: h/2026-10-19-ar0145-resources-batch-00d689f3
- Commit reviewed: fd8e0f2e0f596867c4e852b543d9ce2971a1309e
- Verdict: PASS

## Final message

All verified. Summary of findings follows.

**Fix commit 12261a5 (packages/core/test/scope.test.ts):**

The prior flake (`ended !== working`, GitHub run 39284894759) came from the test reading `other` job's `state` file immediately after the hog job ended, with no wait — a direct violation of "wait for the state it asserts" (styleguide). Root cause: `oomFirst()` (job-memory.ts) sets the wrapper's own `oom_score_adj` to 1000 right before `spawn()`, so every forked agent inherits score 1000 at fork time; the `hogging()` script's non-hog branch must explicitly reset its own score back before it execs the fake agent. On a slow/2-core runner this reset could lose the race against the kernel's OOM scan, so the "innocent" job's agent could be killed alongside the hog, instead of the hog alone — that's what the premature `state === "working"` read caught as flaky.

The fix: (1) adds an assertion, taken right when the "other" job's agent writes its `starts` file (after `until`, so no new race — the shell script's reset statement runs synchronously before `exec $played`), that its `oom_score_adj` equals this test process's own value, confirming the reset already completed *before* the hog is even spawned; (2) replaces the premature immediate state read with `await endedWith(home, other.id)` resolving to `"finished"` after the gate is released — a proper wait for the actual terminal state. This correctly closes the race the test was exercising.

**Verification performed (not merely claimed):**
- `npm ci` — clean install, no errors.
- `npm run check` — `tsc` passes, no errors.
- `npm test` — full suite: `tests 708, pass 708, fail 0` (240s).
- `node --import @arthur/core/testing --test packages/core/test/scope.test.ts` run 20× under `taskset -c 0` (single core, as instructed) — confirmed via live polling of all 20 run summaries: every run reports `tests 20 / pass 20 / fail 0`. (The post-hoc archived log artifact dropped one run's header text due to the harness's own storage elision, but the live `proc://` stream showed all 20 runs' `=== RUN N ===` headers and `pass 20/fail 0` summaries directly, with no `fail` count other than 0 anywhere.)
- Merge commit fd8e0f2: budget conflict in `test/structure.test.ts` resolved correctly — comment ledger ends "Merged with main: core 5455 + 31 = 5486, resources 458 + 9 = 467", and `BUDGETS = { core: 5486, …, resources: 467, "core/testing": 349, … }`. Verified by `wc -l`: `packages/core/src/*.ts` total 5835 lines; `testing.ts`(200)+`fake-agent.ts`(149)=349 (matches `core/testing` budget); 5835−349=5486 (matches core budget). `packages/resources/src/*.ts` total 467 (matches). No leftover `<<<<<<<`/`=======`/`>>>>>>>` markers anywhere in the tree.
- Both new commits (`12261a5`, `fd8e0f2`) carry `Signed-off-by:`.
- Commit scope `AR0147` for the fix matches the ticket the test covers; diff is test-only, no src change, no scope creep.

**Notes (non-blocking):**
- The merge pulled in a large amount of unrelated `main` history (AR0151, AR0154, AR0210, etc.) as expected for a `merge origin/main` per the follow-up instruction; only the conflict resolution in `test/structure.test.ts`/`test/structure.ts` is the worker's own content in that commit, which is correct.

No requirement is missing, stubbed, or only claimed; the specific regression named in the Focus (ended !== working) is fixed at its root cause (a real race in test setup, properly closed by waiting for terminal state) and proven stable 20/20 under the single-core constraint matching the failing CI runner.

PASS
