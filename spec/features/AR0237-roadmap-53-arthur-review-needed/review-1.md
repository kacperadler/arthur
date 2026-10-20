# AR0237 - Review 1

- Job: 2026-10-20-review-ar0237-roadmap-53-eee0069d
- Branch: h/2026-10-20-ar0237-roadmap-53-review-bbeeea77
- Commit reviewed: 0a02a3405141e4deef4cc13811461df41a24c4ae
- Verdict: FAIL

## Final message

Clean. Final assessment.

**Findings**

1. `packages/delivery/src/review-needed.ts:79` — `recorded.lastIndexOf("stale")` picks the checks after the *last* `stale`, per the roadmap's explicit rule ("the job's latest checks after the last `stale` decide", restated by the worker as rule 7). I mutated this to `indexOf` (first `stale`) and ran `review-needed.test.ts`: all 5 tests still pass. Constructing the realistic case by hand confirms the bug is real: a checks file with two run/edit cycles, e.g. `check pass\ntest pass 3/3\nstale\ncheck fail\ntest fail 1/3\nstale\n` (two checks, each made stale by a later edit) — correct code answers `review: …; a file changed after the job's checks (stale)` (nothing fresh); the `indexOf` mutant instead slices from the *first* `stale` and reports `review: …; the job's checks: check fail, test fail 1/3`, treating a stale, superseded run as current. Every test case in `BRANCHES` has at most one `stale` token, so this never exercises the "last" semantics. A worker session with more than one check→edit cycle (the common case) is exactly where this family of bug bites, and it goes undetected by the suite. This is a mutation of a named key behavior with no test catching it — a review guide FAIL.

**Notes (non-blocking)**
- `review-needed.ts` uses `--no-renames` and the doc explicitly documents a plain rename as triggering "deletes `<old path>`" (rule 2) — correct per spec and documented, but no test exercises an *unlisted* rename hitting rule 2 (both rename test cases in `BRANCHES` are swallowed by rule 1, the always-review list, so rule 2's own rename handling is implicitly, not directly, tested). Taste-level gap, not blocking.
- The worker's final message asks the human to decide on the "remote worker always gets `review`" tradeoff, but the ticket's own Decisions section (dated the same day) already records this as accepted ("the safe side: more reviews, never fewer"); redundant but harmless.

**Checks run**
- `npm ci`: clean, no output.
- `npm run check`: `tsc` clean, exit 0.
- `npm test`: 817/817 pass, matches worker's claim exactly.
- `wc -l` over `packages/core/src/*.ts` (excl. `testing.ts`, `fake-agent.ts`) = 5713, and `packages/delivery/src/*.ts` = 508 — both match `BUDGETS` in `test/structure.test.ts` exactly, and every file ≤200 lines.
- Manually verified `git diff --no-renames` semantics on a throwaway repo (confirms a bare rename is reported as delete+add, matching the documented rule-2 behavior).
- Mutation tests via `npx tsx --test packages/delivery/test/review-needed.test.ts`:
  - `pass = results.every → results.some`: caught (1 failure, "small, a failing test").
  - `SMALL = 30 → 31`: caught (1 failure, "31 lines").
  - `recorded.lastIndexOf("stale") → recorded.indexOf("stale")`: **not caught** (5/5 pass) — see Finding 1.
- Restored all throwaway edits (`git checkout -- packages/delivery/src/review-needed.ts`); `git status --porcelain` empty before verdict.

FAIL
