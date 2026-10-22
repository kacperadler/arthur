# AR0271 - Review 1

- Job: 2026-10-22-review-ar0271-6e81164f
- Branch: h/2026-10-22-ar0271-72a7b9ab
- Commit reviewed: cd6a8f45e665069c4583a113497215eed5165902
- Verdict: FAIL

## Final message

Worktree clean. Verdict below.

---

**Findings**

1. `packages/resources/src/machine-free.ts:95-100` — the test suite does not pin the invariant that actually fixes AR0271: that this process's own write (and its atomic publish via `renameSync`) happens *inside the same lock* that protected its read. Mutation: move `writeFileSync`/`renameSync` out of the `withLock` callback, leaving only `readSample` inside it (`before = withLock(lock, () => readSample(...)); writeFileSync(...); renameSync(...);`). Ran `packages/resources/test/disk.test.ts` against this mutation: **8/8 pass, including the new two-process test.** This is not a theoretical gap — I independently reproduced the exact race the ticket describes using the real `withLock` from `packages/core/src/lock.ts`, two genuine OS processes, read-then-sleep-then-unprotected-write: both processes saw `before="NONE"` (the same stale prior state), i.e. both would independently decide "this is new" and both would emit, which is precisely the AR0271 bug. The reason the new test can't catch this: its simulated "other process" (`otherCheck`) always writes-then-releases atomically using the raw lock API directly, so it never races against a *second* instance of the mutated `checkSample`; it only proves this process correctly waits for and reads past a well-behaved external locker, not that its own write is itself inside the protected region. The shipped code is written correctly (read and write are in one `withLock` callback), but the test suite would pass unchanged if that invariant were silently broken by a future edit — this is exactly the class of mutation the review guide requires tests to catch, and it slips through.

**Notes (non-blocking)**

- The worker's three claimed mutations (lock removed, `readSample` moved before `withLock`, lock skipped only for a failed check) all reproduce as claimed — independently re-ran each, each fails as described.
- Decisions line accepting the resources budget raise (602→607) is present on `main`'s ticket, as the task's Focus required.
- `resources` package line count is exactly 607 (`cat packages/resources/src/*.ts | wc -l`), matching the updated budget.
- Boundary check: `@arthur/core/lock` is a published export of `@arthur/core`'s `package.json`; no plugin-to-plugin or path import.
- Docs (`packages/resources/docs/resources.md`) updated for both the failure-notice and `disk-low` items, naming the lock file, consistent with the code.
- One commit, Conventional Commits, ticket scope `AR0271`, matches "usual shape."

**Checks run**

- `npm ci`: clean, no output/errors.
- `npm run check` (tsc): exit 0.
- `npm test` (full suite): `tests 1017, pass 1017, fail 0` — matches worker's claim.
- `node --test packages/resources/test/disk.test.ts`: 8/8 pass — matches worker's claim.
- `node --test test/structure.test.ts`: 15/15 pass; budget 607 holds.
- Mutation: lock removed entirely → new test fails ("the other process's check said this fall"), as claimed.
- Mutation: `readSample` moved before `withLock` → new test fails, as claimed.
- Mutation: lock skipped only for a failed check → new test fails ("the other process's check said this failure"), as claimed.
- Mutation: dedup guard (`underFloor(before.disk...)` check) removed entirely → caught (by the pre-existing hovering-floor test and the new test), not a gap.
- Mutation (my own): write+rename moved outside `withLock`, read kept inside → **8/8 still pass, not caught.**
- Direct two-process reproduction of that mutation against the real `withLock` (no test framework involved): both processes observed the same stale `before` state, confirming the mutation reopens AR0271's exact race.
- `git status --short` in the worktree: clean after all throwaway mutations were restored.

FAIL
