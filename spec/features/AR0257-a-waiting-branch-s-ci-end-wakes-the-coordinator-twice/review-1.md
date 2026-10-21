# AR0257 - Review 1

- Job: 2026-10-21-review-ar0257-one-wake-p-5b3e5618
- Branch: h/2026-10-21-ar0257-one-wake-per-ci-e-86ffbf6f
- Commit reviewed: 3a157c69a89152afb39d1434ef16660e779ec626
- Verdict: PASS

## Final message

Both commits signed off, Conventional Commits format with AR0257 scope. Everything verified.

Summary of review:

**Findings:** None blocking.

**Notes (non-blocking):**
- `findings.md`'s F1 entry was first committed with `Status: open` in `0e88376` even though that same commit already contained the fix; `3a157c6` only corrects the status text and the line-budget comment. Cosmetic bookkeeping artifact of a two-step commit process, no functional effect.

**Checks run (in this worktree, against `28fde9aa32..3a157c69a8`):**
- `npm ci` — clean.
- `npm run check` (tsc) — passes, no errors.
- `npm test` — 943/943 pass, 0 fail. Matches worker's claim exactly.
- Line budgets: `cat packages/delivery/src/*.ts | wc -l` → 1263, `cat packages/github/src/*.ts | wc -l` → 630. Matches `BUDGETS` in `test/structure.test.ts` and the ticket's Decision (`delivery 1263, github 630`).
- Boundary check: `grep` for `@arthur/delivery`/`@arthur/github` imports inside the other plugin's `src/` — none. Communication is via `host.provide("delivery.ciEnded", …)` / `host.collect("delivery.ciEnded", …)`, respecting the plugin boundary.
- Mutation 1: in `github.ts`, replaced the `delivery.ciEnded`-filtered `rest` with `ends.map(end => end.branch)` (ignore delivery's answer) → `packages/github/test/github.test.ts`'s new test fails ("every branch woken by delivery: github says nothing" assertion breaks, github also emits a wake for `arthur/waits`). Restored.
- Mutation 2: in `ci-wait.ts`'s `ciEnded`, replaced `if (told.includes(...)) return true;` with `if (false) return true;` (disable once-per-run-attempt idempotency) → `auto-merge.test.ts`'s rewritten test fails (`told once`: 2 !== 1). Restored.
- Mutation 3: in `ci-wait.ts`'s `ciEnded`, changed `below >= wait.own` to `below > wait.own` (off-by-one on the "run below the tip" boundary) → same test fails (a run on main wrongly answers `true`). Restored.
- Verified `git status`/`git diff --stat` clean after each restore.

**Scope/decisions check:**
- Matches the ticket's recorded Decision exactly: delivery alone wakes a waiting branch's run end; github asks `delivery.ciEnded` and excludes `true` branches from its own wake; `ci-finished` event still names every branch (verified in `github.ts` and its test).
- F1 (github's first poll leaving a pre-existing-finished run's waiting branch unwoken) is fixed within the same diff and tested (`github.test.ts`, "a project's first poll asks it of a run already finished, and tells nothing").
- Combined-plugin test (`test/ci-wait-wake.test.ts`) exists as the ticket's Done-means example requires ("a test of both plugins together"), using real git/github fake, polling both plugins, asserting exactly one wake and no further wake after `merge --auto`.
- Docs updated and accurate: `docs/plugin-api.md` (changes log + provided-names table), `packages/delivery/docs/commands/merge.md`, `packages/github/docs/github.md` — all describe the new `delivery.ciEnded` flow correctly, matching the code.
- No files touched outside the ticket's scope; diff stat confined to ci-wait.ts/github.ts/delivery.ts, their tests, docs, findings.md and structure.test.ts budgets.

All Done-means points, the Focus checklist, and the recorded Decisions are satisfied; checks reproduce as claimed; mutations of the three key behaviors (exclusion filter, once-per-attempt dedup, below-the-tip boundary) are all caught by the existing tests.

PASS
