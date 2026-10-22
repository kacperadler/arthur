# AR0305 - Review 1

- Job: 2026-10-22-review-ar0305-f041b690
- Branch: h/2026-10-22-ar0305-eccb8bad
- Commit reviewed: 3144f81e007733d9dd1d2241053270790d792831
- Verdict: PASS

## Final message

All checks reproduce the worker's claims; the fix is correct, scoped, documented, and tested against real mutations.

**Findings:** none.

**Notes:**
- Approach (in-memory device/inode set, not the ticket's suggested token) is explicitly accepted in the ticket's Decisions log, with the worker's final message giving the same correctness argument (old-code race, link/unlink-crash collision) recorded there.

**Checks run (in this worktree):**
- `npm ci`: clean.
- `npm run check` (`tsc`): no errors.
- `npm test`: 1042/1042 pass, 0 fail (full suite, matches worker's claim).
- `node --test packages/core/test/lock.test.ts` standalone: 12/12 pass.
- Reproduced the ticket's exact scenario (own-pid lock file, `takeLock`): before-fix behavior per worker's message was `{heldBy:<own pid>}`; verified on this branch: first `takeLock` succeeds (`release` returned), second `takeLock` on the now-self-held lock correctly reports `{heldBy:<own pid>}` — own live lock is not falsely taken over.
- Mutation testing on `packages/core/src/lock.ts` (each reverted via `git checkout --` before continuing):
  - Drop `pid !== process.pid ||` from the `holder()` condition → race tests fail with `exited with 1`.
  - Force the own-pid branch to always read as not-held (`(pid !== process.pid)` only) → `takeLock refuses…` test fails (own live lock wrongly taken over).
  - Remove `HELD.add` in `hold()` → `queueLock…` and `takeLock refuses…` tests fail.
  - Remove the `now.key !== key` check in `release()` → `takeLock refuses…` test fails (release removes a lock it didn't take, per the inode-reuse scenario the test encodes).
  - Remove `HELD.delete(key)` in `withLock`'s finally → "earlier process of the same pid" and "released lock" tests fail.
  - All match the worker's own mutation table in substance.
- `git status`/`git diff` after mutation testing: clean, worktree restored.

No boundary, shape, or scope violations: change stays inside `@arthur/core`, file is 163 lines (under the 200-line cap), the +17 line-budget raise matches the ticket's recorded Decision exactly, docs (`docs/deploy.md`, `packages/core/docs/commands/run.md`) updated accurately in English, no secrets, no production resource names in tests, no new public listener.

PASS
