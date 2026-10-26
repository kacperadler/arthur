# AR0440 - Review 2

- Job: 2026-10-26-review-0bfe78fe
- Branch: arthur/2026-10-26-worker-8dba5348
- Commit reviewed: 7630c522d6dc821d459f98a8cf600c11893bfe12
- Verdict: PASS

## Final message

## Findings

None.

**Merge resolution in `docs/deploy.md`** (merge `7630c522`, parents `997705f4` and `50e0b15e`):
- **Line 33:** the worker's "Secrets stay in the env file…" bullet keeps its added sentence about hosts without a sandbox. It now reads "…(`/proc/<pid>/environ`), so keep secrets in the env file, never exported in the shell Arthur starts from."
- **Line 34:** AR0439's bullet "A job's launch drops only Arthur's own `ARTHUR_` variables…" follows it unchanged, as main has it.
- **Line 42:** the "Nothing limits the network, and nothing confines reads of files. A job in its sandbox cannot read the environment or memory…" edit merged cleanly, below main's new remote-repository bullet.
- No conflict markers are left in `docs/`, `packages/core/docs/`, `packages/core/test/sandbox.test.ts` or the ticket folder.

**Nothing else changed beyond the reviewed range:**
- I compared `git diff fe0d454c 997705f4` (what review 1 judged, from its merge base) with `git diff 50e0b15e 7630c522` (the range under review now).
- Both touch the same 4 files: `docs/deploy.md`, `packages/core/docs/commands/spawn.md`, `packages/core/test/sandbox.test.ts` and `findings.md`. Each has 51 insertions and 6 deletions.
- The only differences are index hashes, one hunk offset (`@@ -38` → `@@ -39`), and context lines from main: AR0439's bullet and the remote-repository bullet. The changed lines are identical.
- No other file from main differs at the merge commit.

## Notes

- The worker's message is accurate: the only conflict was in `docs/deploy.md`, both sides are kept, and `tsc` passes.
- Its pointer to AR0449 for F1 in `findings.md` is a coordinator matter and does not affect the merge.
- 4 sandbox tests were skipped, all because "this process cannot make a Unix socket itself (it runs in a job's sandbox)". That comes from where this review runs, not from the branch. The AR0440 test is not among them, and it ran and passed.

## Checks run

- `npm ci`: finished with no errors.
- `npm run check`: `tsc` reported no errors.
- `node --test test/readme.test.ts test/structure.test.ts packages/core/test/sandbox.test.ts`: 27 tests, 23 passed, 0 failed, 4 skipped (the reason is above). It includes ✔ "a sandboxed job's command cannot read the environment of the arthur run that spawned it, which holds a secret" (405 ms).
- Per your instruction I did not run the full `npm test`. I also did not repeat review 1's mutation runs, because the code and test changes in the range are unchanged by the merge.

PASS