# AR0425 - Review 1

- Job: 2026-10-28-review-02c0423e
- Branch: arthur/2026-10-28-worker-04c1fca5
- Commit reviewed: c911625029a1c8861276d7f60e20a2af885e996d
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0425 asks: the redirect's lookup now ends at the check's time limit, all five redirect statuses are tested, the uptime line budget holds, and the checks pass.

**Findings**

None.

**Notes (not blocking)**
- `packages/uptime/src/site-check.ts:30`: each hop to another host adds an abort listener to the check's signal and never removes it. That is at most 20 listeners, only for the life of one check. A small throwaway script added 12 listeners to an `AbortSignal.timeout` signal and Node printed no warning. Adding `{ once: true }` would not remove the listener after a lookup that succeeds either, so leaving it as it is is fine.
- The worker kept `new Promise` instead of `Promise.withResolvers()`, which the worker says a rule asks for, because the longer form put uptime at 305 lines against its budget of 298. The reason is given, and the budget check passes at exactly 298 (57 + 76 + 34 + 131).
- `findings.md` F1 (a core limits test that is flaky under load) is outside the two files the ticket scopes. It is the normal place for a worker to record findings, and it names nothing outside Arthur.
- The time-limit test runs its two scenarios inside one `checkSite` test, with bounds of 990–2000 ms and 1100–2000 ms. They held in my runs, even on a loaded machine.

**Against the ticket**
- **Lookup bounded by the limit:** the lookup now races the check's `signal`. The reason comes from `failure(..., signal.aborted)`, so it is `no answer within 1 s`. If the limit has already passed, `throwIfAborted()` stops the lookup from starting; without it, a listener added to a signal that has already fired would never be called.
- **The test:** a `lookup` for `slow.example` that never answers ends the check between 990 and 2000 ms with that reason, and the lookup is asked once. A second case delays a body cancel past the limit, so the lookup never starts.
- **Statuses:** the hop test has a site for each of 301, 302, 303, 307 and 308, and each one's target page must be reached twice.
- **Files:** only the two files the ticket scopes, plus `findings.md`, are changed.

**Checks run**
- `npm ci`: exit 0.
- `npm run check`: tsc clean.
- `npm test` in the foreground with a 1800 s timeout: the harness moved it to the background, and it then finished with 1261 tests, 1199 pass, 0 fail, 62 skipped. The `packages/core/test/limits.test.ts` test that failed for the worker passed here. I started a second run writing to a log file in the worktree, stopped it once the first run had finished, and deleted the log.
- `node --import @arthur/core/testing --test packages/uptime/test/*.test.ts test/structure.test.ts`: 39/39 pass, budget check included.
- Mutations, each restored with `git checkout -- packages/uptime/src/site-check.ts`; `git status` was clean afterwards. Every one was caught:

| Mutation | Result |
|---|---|
| Remove `signal.throwIfAborted()` | Lookup test fails at its 10 s timeout |
| Remove the abort listener | Lookup test fails at its 10 s timeout |
| Drop 308 from the status list | Status test fails: "timed out waiting for the down notice" |
| Drop 303 | Same failure |
| Drop 301 | Same failure |

- The worker's claims match what I saw: tsc clean, the single-line change, the budget at 298, and the mutations caught.

PASS