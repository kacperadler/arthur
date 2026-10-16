# AR0011 - Review 2

- Job: 2026-10-16-review-ar0011-arthur-run-38676d18
- Branch: h/2026-10-16-ar0011-arthur-run-135ec570
- Commit reviewed: beff2c378bd6ba9ec5f5df60b67f5eed0e8d5e24
- Verdict: PASS

## Final message

Worktree clean, no leftover mutation.

---

**Findings:** none.

**Notes:**
- Merge commit beff2c3 is a textbook conflict resolution: `lock.ts` merged automatically (git applied AR0036's one-line recursion change cleanly on top of the branch's rewritten `takeOver`/`holder`), and only `lock.test.ts` needed manual resolution (import union + both test blocks), exactly as the worker's final message describes.
- The `crashed(pid)` test helper correctly produces `<pid>` (no boot id) or `<pid> <bootId>` depending on `BOOT_ID` file existence, matching `own()`'s write format in `lock.ts`, so the dead-holder and race tests exercise the real on-disk format.

**Checks run (in this worktree, on commit beff2c3):**
- `npm ci`: succeeds.
- `npm run check`: `tsc`, no errors.
- `npm test`: 116 tests, 116 pass, 0 fail — matches worker's claim.
- `node --import @arthur/core/testing --test packages/core/test/lock.test.ts` × 10: each run 7/7 pass, 0 fail — matches worker's claim.
- Code review confirms `lock.ts` keeps: `takeLock`, `own()`/`bootId()` writing `<pid> <bootId>` (or bare pid when no boot id file), `holder()`'s `thisBoot` earlier-boot staleness check, and AR0036's `takeOver(guard, mine, other)` recursive guard takeover with the pid+inode match check reused through the same boot-aware `holder()`.
- `lock.test.ts` has all 7 tests: the branch's 4 (basic lock, live-holder refusal, dead/no-pid/earlier-boot takeover, `takeLock` refuse/release) plus AR0036's 3 (crashed-guard cleared, original race, race-past-a-crashed-guard at 50 rounds).
- Mutation check: reverted the recursive guard takeover to the pre-AR0036 naive `rmSync(guard, { force: true })` in this worktree (throwaway edit), reran `lock.test.ts` 3×: the "past a crashed taker's guard" race test failed reliably each time (6 pass / 1 fail), proving the test suite does catch removal of the recursive takeover. Restored the file afterward; `git status` clean.

PASS
