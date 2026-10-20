# AR0244 - Review 1

- Job: 2026-10-20-review-ar0244-roadmap-61-165490c7
- Branch: h/2026-10-20-ar0244-roadmap-61-stats-fb19af34
- Commit reviewed: 3a47c21cadf51cad0da38ead7ceb27d9ce3c3bc5
- Verdict: PASS

## Final message

Worktree clean.

**Findings:** none blocking.

**Notes:**
- `stats.ts:73-75`: `where` lookup and its `throw new Error("unknown project …")` are unreachable — `host.board.list(project)` at line 71 already throws its own, more detailed message (`unknown project X; projects: a, b`) for an unknown project, so the explicit throw never fires. Harmless dead code, not a behavior bug (test for the unknown-project case passes via board's own throw, matching the doc's claim of "the board's refusal").
- Ticket's open question ("cost file" ambiguity) was already resolved by the ticket's own Decisions section (coordinator: read from `outcome.md`'s `- Cost:` line); worker's implementation matches that decision exactly, so the "needs from coordinator" note in the final message restates an already-settled decision rather than raising a new blocker.

**Checks run:**
- `npm ci`: clean (lockfile already satisfied).
- `npm run check` (tsc): clean, no errors.
- `npm test` (full suite): 862/862 pass, 255.8s — matches worker's claim.
- `node --test packages/manage/test/*.test.ts`: 19/19 pass, including 4 new `stats.test.ts` tests.
- `node --test test/structure.test.ts`: 15/15 pass; `wc -l packages/manage/src/*.ts` → 369 total, matches the raised budget and the comment's accounting (stats.ts 99 + manage.ts 118, with 13 lines added to manage.ts’s existing 105).
- Hand-verified the multi-ticket fixture in `stats.test.ts` (7 tickets, mixed reviewed/unreviewed/autopilot/missing-cost/n/a-cost/timezone-crossing dates) against the code's logic by hand: mean rounds (1.5 over 4), first-round PASS (2/4), autopilot (1/6=17%), most-expensive top-3 with correct sort and unknown count (2), and the timezone-driven day counts (23:30 UTC → next day in Europe/Warsaw) all match the asserted output.
- Mutation testing on `packages/manage/src/stats.ts` and `manage.ts` (each applied, tested, restored via `cp`/`git checkout --`, confirmed `git status --porcelain` clean afterward): (1) missing-cost-as-0 instead of unknown — caught; (2) unreviewed tickets included in mean — caught; (3) "no merged ticket" refusal disabled — caught; (4) autopilot detection inverted — caught; (5) merged-status filter removed — caught; (6) most-expensive sort inverted — caught; (7) review sort by filename instead of numeric N (review-10 vs review-2 ordering) — caught; (8) merge-day computed from UTC instead of `core.timeZone` local date — caught; (9) FINDINGS heading regex disabled — caught; (10) stats command's extra-argument usage/exit-2 check disabled — caught. All 10 mutations were caught by the existing test suite; none slipped through.
- Confirmed `Pick<Host, "board" | "clock">` / `Pick<Host, "board" | "clock">` usage: only `board.list`, `board.projects`, `clock.local`, `commands.register` touched — no new host member, matching the ticket's "stop and say so" constraint and the claim.
- Confirmed no `phone` key registered for `stats` (Command.phone is optional) — matches "No `/stats` phone command" claim.
- README/`arthur.mmd` diff matches the claimed "2 of 5 entries", "60, 61 built" updates; both files changed identically for the mermaid block per the repo's own structure test (`the README's mermaid block is arthur.mmd, unchanged`), which passed.
- Commits: both present, signed off, Conventional-Commits scoped to AR0244, matching final message.

PASS
