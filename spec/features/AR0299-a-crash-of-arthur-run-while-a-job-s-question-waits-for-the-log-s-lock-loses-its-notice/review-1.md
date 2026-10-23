# AR0299 - Review 1

- Job: 2026-10-22-review-ar0299-5bef25b7
- Branch: h/2026-10-22-ar0299-69921f31
- Commit reviewed: 7519341df26582225e140a8eff71291e7816d30d
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

Findings: none that block the merge.

Notes:
- F1 in findings.md (own-pid-across-boot lock false-positive) is a pre-existing `@arthur/core/lock.ts` edge case, correctly scoped out and recorded `open` for the coordinator to turn into a ticket; not introduced by this diff and not required by AR0299's Done means.
- The ticket's Decisions already carry the 2026-10-23 line budget approval (orchestration 2285→2309) when read from `main`; worker's final message flagged it as needing action, but it's already recorded, so nothing further for the coordinator here.
- The worker departed from the ticket's literal wording ("let a replay... find the mark without the second") by doing the check at `arthur run`'s start instead of on event redelivery, with a concrete reason (the core never redelivers a once-handled event): this matches the ticket's actual Goal ("the replay after the restart sends the notice") and is explained in the final message, so not a Plan-departure FAIL.

Checks run (in this worktree, not the main checkout):
- `npm ci`: clean install, 22 packages.
- `npm run check`: `tsc`, no output, exit clean.
- `npm test`: full suite, `tests 1037, pass 1037, fail 0` — matches worker's claim.
- Targeted reruns of `packages/orchestration/test/job-states.test.ts` and `coordinator.test.ts`: 24/24 pass, including the new crash-recovery test and the extended one-notice-per-block test.
- Mutation testing (throwaway edits, restored after each, final `git status --short` clean):
  - Removed the `heldBy` live-lock guard → crash test fails (asks again while another process holds the lock).
  - Removed the `.sent` check → crash test fails (double notice for case e).
  - Forced `again = false` always → crash test fails (b's question asked twice instead of reused).
  - Forced `again = true` always → one-notice-per-block test's new assertion fails (new block reuses old question id).
  - Dropped the `job ===` condition from the reuse lookup in `askOfJob` → crash test fails (c wrongly reuses b's open question).
  - Dropped the time check in the start-recovery event lookup (`Date.parse(each.time) === time`) → crash test fails (f's gone-by-time event wrongly resurrected).
  - All six mutations caught by the existing permanent tests; matches the worker's claimed mutation coverage for these cases.

PASS
