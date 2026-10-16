# AR0070 - Review 2

- Job: 2026-10-16-review-ar0070-continue-k-3f9344b8
- Branch: h/2026-10-16-ar0070-continue-killed-b-771a00d8
- Commit reviewed: 7d76d132d1c1441d6d9d4b1d813ac097af66a544
- Verdict: PASS

## Final message

The new test catches both mutations, so the earlier finding is fixed. I'm passing the branch.

**Findings:** none. The one earlier finding was that the "wait until running (or wrapper gone)" loop in `job-control.ts` had no test. Commit `7d76d13` adds one test to `job-control.test.ts` and changes no source. It puts a fake `systemd-run` on `PATH` that writes `pid`, sleeps 1 s, then starts the real wrapper.
- **Wrapper starts late:** `jobs.continue` returns only once the state reads `running`.
- **Wrapper gone:** with the fake exiting without starting a wrapper, the continue returns and the state is still `done`.

**Notes:**
- A continue killed between the wrapper's `pid` and `state` writes stays open as F1 in the ticket's `findings.md`. That matches the worker's claim.
- The second mutation left fake-agent processes holding the test process, so I killed them and confirmed none of mine remain. The test has a 30 s timeout, so it fails rather than hangs. The leftover processes are a test-hygiene point I did not dig into.

**Checks run:**
- `npm ci`: installed cleanly.
- `npm run check`: clean.
- `npm test`: 270 tests, 270 pass, 0 fail.
- **Mutation 1, wait loop deleted:** `job-control.test.ts` ran 21 pass, 1 fail. The failure is the new test. This was the mutation the earlier review said no test caught.
- **Mutation 2, `field("state") !== "running"` condition dropped:** the new test did not finish; the run hung until my 200 s command timeout, which counts as caught.
- Both mutations reverted; `git status --short` is clean.

PASS
