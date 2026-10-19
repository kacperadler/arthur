# AR0149 - Review 1

- Job: 2026-10-19-review-ar0149-resources-22829650
- Branch: h/2026-10-19-ar0149-resources-pair-f2e0e6b4
- Commit reviewed: ea88082f6e77d42e3049eb94b794e71b29103637
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

---

**Findings:** none blocking.

**Notes (non-blocking):**
- `spec/features/AR0149.../findings.md` F1 (open) correctly flags that `fresh()`'s fixed `2 * CHECK_SECONDS` (120 s) staleness window is decoupled from `machines`' `check.everySeconds`, so a spawn between rounds when `everySeconds > 120` still makes a second ssh call. This is explicitly out of scope per the ticket's Done means ("out: any change to how room is computed") and is honestly disclosed as an open finding for a follow-up ticket, not a regression of the stated Done means (default 60 s cadence has exactly one ssh call per machine per round, proven by test and mutation).
- The three "choices" the worker flagged (line budgets 456/483, hook name `machines.round`, offline-on-failed-`node -e`) are all already accepted in AR0149's own Decisions list, so nothing remains open for the human on those.

**Checks run (in this worktree, not the main checkout):**
- `npm ci` — succeeded (16 packages).
- `npm run check` — passed, no tsc errors.
- `npm test` — 718/718 passed, 0 failures (ran to completion, ~247 s).
- Manual code reading confirms: `job-scope.ts`'s `setSlice` only adds `MemorySwapMax` via the `more` rest-param for a ticket's feature slice (`0` with a memory cap, `infinity` without), the joint slice's `setSlice(jobs.slice, …)` call passes no extra args and stays untouched; `machines.ts` hands `host.collect("machines.round", Map<name, Promise<{free}|{error}>>)` before any check in the round settles; `resources/room.ts`'s `fresh()` prefers an in-flight `checking` entry (round or demand check) over a stale/fresh cached sample; `machine-check.ts`'s SCRIPT folds `node -e` into the same `&&` chain so a nonzero exit takes the machine offline.
- Mutation testing (throwaway edits, reverted via `git checkout`/backup+restore, verified `git status` clean after):
  - Always `MemorySwapMax=infinity` on the ticket slice → `scope.test.ts`'s continue test fails (`actual` keeps `infinity` where `0` expected).
  - Always `MemorySwapMax=0` on the ticket slice → same test fails on the reset-to-`infinity` assertion.
  - Also give the joint slice `MemorySwapMax=0` → same test fails (joint slice's `infinity` assertion breaks).
  - Disabled the node-e-failure → offline check (`if (false) return offline(...)`) → `machines.test.ts`'s node-e-fail test fails (`actual: 'ok (...)'` instead of `missing: …`).
  - Removed the `host.collect("machines.round", …)` call → `machines.test.ts`'s round test fails (`0 !== 1`, "one hook per round").
  - Removed the in-flight-round check in `room.ts`'s `fresh()` → `room.test.ts`'s round-wait test fails exactly as the worker reported (`actual: 7` where `0` expected).
- All five mutations were caught by the existing test suite; no untested key behavior found.
- Docs (`spawn.md`, `resources.md`, `machines.md`, `deploy.md`, `arthur.config.example.ts`) read and match the implementation.
- No plugin-boundary violation: `grep` for `@arthur/resources`/`@arthur/machines` cross-imports in each other's `src/` found none; communication is only through `host.collect`/`host.provide("machines.round", …)`.
- File line counts for all touched source files are under 200; package budgets raised to 456 (machines) and 483 (resources) match the ticket's accepted Decision and `structure.test.ts`'s comment/value.
- Commits: two, Conventional Commits, each scoped `(AR0149)`/`(AR0217)`, each `Signed-off-by:` present, matching "one signed-off commit each."

PASS
