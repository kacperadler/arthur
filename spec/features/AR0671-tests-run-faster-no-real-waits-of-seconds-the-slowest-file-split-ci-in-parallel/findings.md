# AR0671 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The github rate-limit test still waits about 10 s of real time

- Kind: test
- Found by: 2026-11-10-worker-4b7cab02 (worker), 2026-11-10
- Where: `packages/github/test/github.test.ts:327`
- What: "a rate limit stops the instance's requests until the time GitHub says" waits for real `x-ratelimit-reset` and `retry-after` seconds (3 s, 2 s, 6 s): 10.5 s alone (`node --import @arthur/core/testing --test packages/github/test/github.test.ts`).
- Suggestion: mock `Date` only (`t.mock.timers.enable({ apis: ["Date"] })`), so polls stay on real timers, and tick to each reset; prove "no request meanwhile" with a second, unpaused instance whose polls go on. That needs `next` in `fake-github.ts` to take an optional path, as now any request takes the queued reply.
- Status: fixed in ca4b2f06

## F2. Tests that wait on real 1 s ticks or fixed 1.2 s sleeps

- Kind: test
- Found by: 2026-11-10-worker-4b7cab02 (worker), 2026-11-10
- Where: `packages/uptime/test/uptime.test.ts:343` (11 s), `packages/session/test/restart.test.ts` (18 sleeps), `packages/session/test/service.test.ts`, `packages/session/test/compaction.test.ts:101` (14 s)
- What: "this machine offline" in uptime waits about ten real check rounds of 1 s (its probes reject at once, so no 10 s limit is involved, unlike plan.md's table says); the session plugin's tests wait on its 500 ms tick and on `sleep(1200)` "nothing happens" checks (FIXED_WAITS). Each such test takes 3 to 14 s.
- Suggestion: fake `setInterval` and `Date` for the plugins' ticks where their I/O allows it, one file at a time; out of this ticket's list of tests that wait out a limit.
- Status: fixed in ca4b2f06

## F3. The merge.stepSeconds test runs 3.5 s, not under 3 s

- Kind: test
- Found by: 2026-11-10-worker-4b7cab02 (worker), 2026-11-10
- Where: `packages/delivery/test/merge-steps.test.ts` ("a step still running at merge.stepSeconds is killed")
- What: with `stepSeconds: 2` it takes 3.5 s alone: about 1.5 s of worker, review and merge, and the 2 s limit. With 1 s, `npm test`'s own start under a loaded host (AR0544) could pass the limit before the slow script writes its pid, and the test would fail by chance.
- Suggestion: leave it, or fake the step's timer in `merge-checks.ts`'s runner if a test kit for it ever exists.
- Status: fixed in ca4b2f06

## F4. The 30 001 px page test does work, not a wait

- Kind: test
- Found by: 2026-11-10-worker-4b7cab02 (worker), 2026-11-10
- Where: `test/report-check.test.ts` ("a page 30 001 px tall is shot whole")
- What: 17 s in the full run here; it starts Chrome for 21 slices. No timeout is waited out, so this ticket's way (a short limit) does not apply (plan.md, Open questions).
- Suggestion: a planning ticket on tests slow from work, with the others plan.md names (job-gate, dokploy upload, --auto held paths).
- Status: open

## F5. Two session tests run 3 to 4 s, mostly from the agents they start

- Kind: test
- Found by: 2026-11-10-worker-4b7cab02 (worker), 2026-11-11
- Where: `packages/session/test/compaction.test.ts` ("a handoff write that fails withdraws the compaction"), `packages/session/test/start-notice.test.ts` ("no LLM access")
- What: 3.9 s and 3.1 s alone with the session's tick at 100 ms (`node --import @arthur/core/testing --test "packages/session/test/**/*.test.ts"`): the first starts a fake coordinator for each of its 4 cases, each case also waiting the handoff extension's settle time of 4 ticks (400 ms here, about 1.6 s in all); the second starts a fake agent for each of its 9 cases.
- Suggestion: with the tests slow from work of F4's planning ticket; one test per case would rename tests, which this ticket rules out.
- Status: open
