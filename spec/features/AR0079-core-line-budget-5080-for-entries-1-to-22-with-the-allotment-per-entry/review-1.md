# AR0079 - Review 1

- Job: 2026-10-16-review-ar0079-core-budge-0025f639
- Branch: h/2026-10-16-ar0079-core-budget-5080-45addcb8
- Commit reviewed: aed9d0913632a4fcaea178883d9d9741b5c85ffa
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

**Findings:** none.

**Notes:**
- Plan proposal 8 says the budget "lands … in `test/structure.test.ts` alone," but the ticket's final Decision explicitly overrides this ("Coordinator: accepted: test/structure.ts changed so the kit gets its own budget"). Worker's departure from the plan text is justified by that later decision and flagged honestly in the final message — not a FAIL.
- Comment arithmetic is non-obvious (95 bug-ticket allotment minus the 9 already spent by merged AR0068/70/71, plus a 5-line buffer folded into `core`'s budget rather than `core/testing`'s) but verified consistent: 3921 (current core prod) + 886 (remaining allotment) + 5 (buffer) = 4812; kit 268 = 268 exactly; 4812+268=5080.

**Checks run (in worktree, this range only):**
- `npm ci` — clean, no errors.
- `npm test` — 272/272 pass, including the new kit test and updated budget/no-budget tests.
- `npm run check` (`tsc`) — exit 0, no output.
- Live `checkStructure('.', {core:4812,'core/testing':268})` against the real tree → `[]` (no violations); `{core:3920}` → `"has 3921 source lines, over its line budget of 3920"`; `{core/testing:267}` → `"its test kit … has 268 lines, over its line budget of 267"`. Confirms both budgets sit exactly at today's measured counts, as claimed.
- Mutation testing against `test/structure.ts` (each applied, run, reverted with `git checkout --`):
  1. Route kit lines into `sourceLines` instead of `kitLines` → test "the core's test kit…" fails (catches regression to old single-counter behavior).
  2. Disable the missing-kit-budget refusal → same test fails (missing-budget case uncaught).
  3. Disable the over-kit-budget refusal → same test fails (over-budget case uncaught).
  4. Apply `TEST_KIT` routing to every package, not just `core` → same test fails (telegram's `testing.ts` wrongly reported as kit, not source).
  All four mutations are caught by the existing suite; no silent regression path found.
- Confirmed the plugin's own `src/testing.ts` still counts toward the plugin's own budget (not the kit): test asserts `packages/telegram/src/testing.ts` grows `telegram`'s source-line count, not `core/testing`.
- Confirmed CHANGELOG convention: it's machine-generated at merge (`h changelog`), so the worker's decision not to hand-edit it is correct, matching repo history.
- Diff is exactly the 2 files, +40/−13, as the final message states; nothing else touched.

PASS
