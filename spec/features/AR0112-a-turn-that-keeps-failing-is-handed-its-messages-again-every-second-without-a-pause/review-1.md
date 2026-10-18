# AR0112 - Review 1

- Job: 2026-10-18-review-ar0112-redelivery-e6ed5651
- Branch: h/2026-10-18-ar0112-redelivery-backof-852933a6
- Commit reviewed: 7f14bceaa9d3e0742a5b0cd65edd2868bdb81ea5
- Verdict: PASS

## Final message

Worktree clean. All findings confirmed, full diff reviewed end-to-end.

**Findings:** none that block merge.

**Notes:**
- `packages/orchestration/src/inbox-extension.ts:105` — the F1 reset reads every currently-queued message's `channel` on each tick while a wait is pending; cheap (small in-memory `Map`/array), not a concern.
- The two real-time tests in `inbox.test.ts` (streak + F1) make the suite take ~115 s; acceptable per repo convention (real Git/timers, no fakes for timing), already present before this ticket.

**Checks run (in this worktree, range `18cb0863..7f14bce`):**
- `npm ci`: installs cleanly (7 packages).
- `npm run check` (tsc): clean, no errors.
- `npm test`: 389/389 pass, 0 fail — matches worker's claimed count. New test `"a new owner message ends the wait: ..."` passes (5.0 s).
- Line budget: `find packages/orchestration/src -name '*.ts' | xargs wc -l` → 697, matching `test/structure.test.ts`'s updated `orchestration: 697` and the ticket's new Decision line (690 → 697, +7).
- Ticket diff (`18cb0863` → `7f14bce`): the Done-means line and the Decision line from the follow-up are present **word-for-word** as the follow-up specified.
- `findings.md` F1: `Status: fixed in 95f524d` — matches instruction ("set F1 to fixed (commit)").
- Docs (`coordinator.md`): paragraph correctly updated to state an owner message (`message-received`) ends the wait and carries queued messages with it; a job's end/plugin message keeps waiting — matches code and test.
- Mutation testing (own, in this worktree, reverted after each):
  - Removed the F1 line (`resume = 0` reset) entirely → F1 test fails: `"the owner's message goes at the next tick: 3500"`. Caught.
  - Widened the condition to end the wait on **any** queued message regardless of channel (`names.length > 0` instead of the channel check) → F1 test fails: `"a message from Arthur does not end the wait"` (`3 !== 2`). Caught — confirms the schedule/Arthur-message exclusion is actually enforced, not just documented.
  - Restored source after each; `git status --short` clean at the end.
- Verified semantics: F1 resets `resume` (not `unanswered`), so a failed turn that includes the owner's hand-over still lengthens the next wait (doubling continues) — matches worker's claim, confirmed by reading `agent_end`/`tick` together.
- Boundaries/styleguide: no new imports, no runtime dependency, no class/enum, no `index.ts/types.ts/utils.ts`; `inbox-extension.ts` stays at 176 lines (<200 budget). Conventional Commits with `AR0112` scope on both commits.

Everything the worker's final message claims (behavior, checks, file changes, commit) reproduces exactly.

PASS
