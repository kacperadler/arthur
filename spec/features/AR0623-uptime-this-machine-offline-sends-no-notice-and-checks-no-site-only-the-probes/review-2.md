# AR0623 - Review 2

- Job: 2026-11-04-review-05230e57
- Branch: arthur/2026-11-04-worker-a260185c
- Commit reviewed: 4104779cb71ba361f02e5bccf627aa2146a7a890
- Verdict: PASS

## Final message

The branch fixes the review-1 finding. With `probes: []`, an offline state saved earlier is now ignored and cleared, each site is judged alone, and the new test fails without the fix. I found nothing that blocks the merge.

- **Fix:** `packages/uptime/src/uptime.ts:119` (`begin`) sets `offline` to `undefined` when `probes.length === 0`, so a stored offline is ignored. `save()` then drops it from `state.json`. The offline check at `uptime.ts:102` only runs when `probes.length > 0`, so with `probes: []` each site is judged alone.
- **Docs:** `packages/uptime/docs/uptime.md:65,69` says the same: each site is judged alone with `probes: []`, and a stored offline is ignored then. The comment in `arthur.config.example.ts` was updated to say offline sends no notice and checks no site.
- **New test:** `uptime.test.ts:361` stores an offline state, starts with `probes: []`, and asserts the site's down notice, at least 2 requests to the site, and `offline` cleared from the state. It fails when the fix is removed (mutation below).
- **Other Done means points:** I read the rest of the diff but did not test it beyond the full suite. It sends no offline notice (a log line instead), asks only the probes while offline (the test counts site requests), resumes with a log line and no notice, and sends nothing across a restart.

## Notes
- (minor) `spec/roadmap.md`, `findings.md`: the range also records a Discord menu test that failed once under load, in commit `1aa5d713`. This is outside Scope In but is only a doc record, not code.

## Checks (on 4104779c)
- **`npm run check`:** passed; tsc reported no errors.
- **`npm test`:** 1537 tests, 1471 passed, 2 failed, 64 skipped. Both failures are in files the range does not touch: `packages/core/test/git-config.test.ts:85` and `packages/delivery/test/checks.test.ts:145`.
  - Run alone, both files fail the same way. My shell had `GIT_NO_REPLACE_OBJECTS=1` set, and those tests check how replacement refs are read.
  - Rerun with that variable unset (`env -u GIT_NO_REPLACE_OBJECTS`): 21 tests, 21 passed, 0 failed. So the cause is my environment, not the branch.
  - No timing test failed, so I did not run `limits.test.ts`.
- **Mutation 1:** I removed `|| probes.length === 0` from `begin`. `uptime.test.ts` then had 24 tests, 1 failed: "with probes: [] an offline stored before … is ignored and cleared". I restored the file with `git checkout`.
- **Mutation 2:** I removed `probes.length > 0 &&` from the offline check. Then 2 of 24 failed: the two-sites `probes: []` test and "one site with no answer is down after 2 failed checks, with probes: []". Restored the same way; `git status --short` is clean.
- **`npm run mutate`:** not run, to keep within the small budget you set.

PASS