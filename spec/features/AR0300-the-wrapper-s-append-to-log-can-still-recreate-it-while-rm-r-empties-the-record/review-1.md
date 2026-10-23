# AR0300 - Review 1

- Job: 2026-10-22-review-ar0300-528d87ad
- Branch: h/2026-10-22-ar0300-f1036105
- Commit reviewed: 575884aeae262a2b7fd9b8b20367bb982e335215
- Verdict: PASS

## Final message

No package.json changes. Review complete.

**Findings:** none.

**Notes:**
- `wrapper.ts` is now exactly 200 lines, the structure test's own cap (`a source file of exactly 200 lines passes, 201 lines fails`) — right at the edge but within budget; no action needed.
- F1 (steer.ts/worktree-guard.ts still create `log` via `appendFileSync`'s default flag) stays open in findings.md, correctly out of this ticket's scope (`packages/core/src/wrapper.ts` only per Scope).

**Checks run (in this worktree):**
- `npm ci` — clean.
- `npm run check` — `tsc`, no errors.
- `npm test` — 1036/1036 pass, 0 fail (matches worker's claim).
- Mutation 1: restored `O_CREAT` on the append-open flag (reintroducing the original bug) → the new regression test `a record rm -r empties, its log unlinked first...` fails with `ENOTEMPTY: directory not empty, rmdir ...` — exactly the bug the ticket describes. Confirms the test is load-bearing for the `openSync` fix.
- Mutation 2: reverted `gone()` to drop the `log`-missing check (kept the `O_APPEND`-without-`O_CREAT` fix) → same test times out waiting for the agent/wrapper to end (uncaught ENOENT crashes the clean-leave path instead of the one-line end). Confirms `gone()`'s `log` check is independently load-bearing.
- Restored `wrapper.ts` after each mutation; `git status --porcelain` clean afterward.
- Diffed `575884a` alone against its parent: exactly 2 lines added to `spawn.md`, matching "Add one line... No other change" from the follow-up instruction verbatim (the known-limit paragraph, worded as quoted in the worker's final message).
- Diffed `cf684f0` (the underlying fix, already present before the follow-up) alone: touches exactly `wrapper.ts`, its test, `spawn.md` (behavior-description update for the `log`-aware `gone()`), `test/structure.test.ts` (budget 5753→5755, matches accepted Decision), and the ticket's `findings.md` (F1) — all within ticket Scope/Decisions.
- Full-range diff stat (`24a3ba4..575884a`) touches only those same 5 files; the merge of main brought in no extra net changes (main's own unrelated commits don't show up, as expected for a clean merge).
- Verified by direct read that the "`<home>/wrapper.log` also holds whatever a wrapper prints that has no record to go to, such as a crash." sentence is still present in `spawn.md` (line 93, offset ~770+) — an earlier truncated read made it look dropped; the full line confirms it is not.
- No `package.json` changes (no new runtime/dev dependency).
- Core budget raise to 5755 matches the ticket's accepted Decision; structure test (line-budget, boundary, shape checks) passes in the full `npm test` run.

PASS
