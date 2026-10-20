# AR0223 - Review 1

- Job: 2026-10-20-review-ar0223-claim-repl-11310291
- Branch: h/2026-10-20-ar0223-claim-reply-sent-ec2362fc
- Commit reviewed: 15d8d4ce29c4e7d4045cc4864117d4800b0e79a9
- Verdict: PASS

## Final message

Clean — mutation edits fully reverted.

---

**Findings:** none that block merge.

**Notes (non-blocking):**
- `packages/orchestration/src/inbox.ts:45-47`: the dedup filter matches any `coordinator-replied` event with `answers === [seq]`, whether it came from a part's claim (`message-parts.ts`) or from the final queued reply the extension later emits (`inbox.ts` sweep, line 158) when that final reply answers only this one message. If a message's file were ever back in `received/` *after* it was already fully queued and answered (requires a prior broken invariant — `queue()`'s own existing dedup already prevents re-queueing, and this scenario isn't the one the ticket names), the fix could mistake that final reply for a claim-reply and swallow the real re-emission. Out of ticket scope (Scope: `inbox.ts` and its tests; this needs an already-broken precondition), not a blocking finding.
- Ticket's Decisions already records the budget raise 1427→1433 (added to `main` after the job ran); worker's final message says it didn't edit the ticket, but it's recorded now, so the Decisions requirement is satisfied as the ticket stands.

**Checks run (in this worktree, range `83b044c..15d8d4c`):**
- `npm ci` — clean.
- `npm run check` — `tsc`, no errors.
- `npm test` — 761/761 passed, 0 failed (247s), matches worker's claim.
- Mutation: forced `logged` array empty (disabled dedup) → `node --test --test-name-pattern="restart after a claim"` fails, showing "Heard: Start AR0081." sent twice — confirms the restart test catches duplicate-reply regressions, not a tautology.
- Mutation: removed `Date.parse(own.time) === ms` guard → `node --test --test-name-pattern="log cut by hand"` fails (expected reply list empty instead of `["Heard."]`) — confirms the hand-cut-log guard is load-bearing and tested.
- Traced restart test manually: the audio-part claim returns a never-resolving promise (`Promise.withResolvers<never>().promise`) while `cut` is `true`, so the first `inbox()` pass is genuinely suspended mid-`turnText`, not raced with a timer; the second `inbox()` instance shares the same `fakeHost` event bus/folder, mirroring a real process restart reading the same on-disk log and files. File restored, `git status` clean.
- Confirmed `queue.ts`'s pre-existing dedup (unchanged in this diff) already covers the worker's named untested case (restart after `queue()` but before `rmSync`), consistent with the `[INFERENCE]` label the worker gave it.
- Scope check: diff touches only `packages/orchestration/src/inbox.ts`, its test, its docs page, and the orchestration line-budget entry in `test/structure.test.ts` — matches ticket Scope (`inbox.ts` and its tests; core untouched).

PASS
