# AR0252 - Review 1

- Job: 2026-10-21-review-ar0252-roadmap-56-c085dcd8
- Branch: h/2026-10-21-ar0252-roadmap-56-change-6b5afa2b
- Commit reviewed: 2464ef3cfd92f09becf5ed56c0e698dfef28bdb4
- Verdict: PASS

## Final message

Worktree clean, all throwaway mutations reverted.

**Findings:** none.

**Notes:**
- Worker left Arthur's own `CHANGELOG.md` untouched (still old-format, written by `h merge`) — reasonable since `arthur merge` isn't yet the tool running on this repo; not a blocker.
- Kind/heading mapping and the dirty-main exemption for `CHANGELOG.md` were both pre-accepted by the coordinator in the ticket's Decisions, so the worker's "confirm" ask in the final message is already settled per the ticket.

**Checks run:**
- `npm ci`: installs cleanly (20 packages).
- `npm run check`: `tsc` clean, no output.
- `npm test`: 880 tests, 880 pass, 0 fail — matches worker's claim exactly.
- Read `changelog.ts`, `merge-command.ts`, `delivery.ts`, `delivery-options.ts`, `changelog.test.ts`, `merge.test.ts` diffs in full; verified against ticket's Done means (no-merged-ticket case, missing-kind case, stable two-run output), roadmap entry 56's Delivers, and the Focus's extra points (rebuild on ticketless merge, CHANGELOG.md exempted only from the dirty-main check, after-merge.md step 4 commits it).
- Verified `docs/plugin-api.md`: `board.list`, `board.projects`, `clock.local`, `commands.register` already published; no new host member, no update needed, matches claim.
- Verified structure-test budget arithmetic: delivery 950→1019 (+69) = `changelog.ts` 64 + `delivery.ts` net +2 + `merge-command.ts` net +3, via `wc -l` and `git diff --numstat`.
- Verified `outcome.md`'s `- Merged: <date>, \`<hash>\`` line format (merge-outcome.ts:52) matches changelog.ts's `MERGED` regex exactly.
- Mutation 1 — removed `Object.hasOwn` own-key guard (`HEADING[kind] ?? "Other"`): caught, 1 test fails (AC0004 with kind `toString` silently dropped from output). Reverted.
- Mutation 2 — removed `CHANGELOG.md` from `DERIVED` (dirty-main exemption): caught, 1 test fails (`arthur merge: main has uncommitted changes in CHANGELOG.md…`). Reverted.
- Mutation 3 — read `kind` from whole ticket text instead of the `## Goal` section only: caught, test fails (every ticket's Description-section `- Kind: bug` boilerplate wins, misclassifying AC0002/AC0003/AC0004/AC0005 under Fixed/Other wrongly). Reverted.
- Confirmed via code reading that a failed main check throws before `writeChangelog` is reached (no changelog written on a merge that didn't go in), matching the new `merge.test.ts` assertion and the worker's claim.
- `git status --short`: clean after all mutation checks reverted.

PASS
