# AR0141 - Review 1

- Job: 2026-10-18-review-ar0141-d4dcf678
- Branch: h/2026-10-18-ar0141-99f8f735
- Commit reviewed: d2e1011151a8c5ab5accadcaec2a3fd3fd30d17d
- Verdict: PASS

## Final message

Clean, at the right commit. Full review complete.

Findings: none blocking. Mutation testing on the four key behaviors (stop-keeps-reason via `kept`, double-stop guard, cost-exactly-at-cap boundary, missing-cost-counts-as-budget) each caught by dedicated tests when disabled/inverted. Line budgets match exactly (core 4786/4786, resources 231/231), consistent with the ticket's accepted Decision, and the worker's `wc -l` claim reproduces. `arthur continue` reuses the same `beforeSpawn` checks (`checks.pass` in jobs.ts), confirming the "also applies to arthur continue" claim is real, not just asserted. Docs (resources.md, commands/resources.md, jobs.md, spawn.md, arthur.config.example.ts, README, arthur.mmd) all updated and accurate against the implementation. No runtime dependency added, no plugin/core boundary violation (resources only imports `@arthur/core` and `@arthur/core/plugin` published exports), no class/enum, every new file ≤200 lines. Findings F1–F3 are correctly scoped as open, non-blocking, outside Done means, with `[INFERENCE]` tags where unverified.

Checks run:
- `npm ci`: clean install, 9 packages.
- `npm run check`: no tsc errors.
- `npm test`: 454/454 pass (background job, full output captured), matching worker's claim.
- Mutation 1: `kept()` forced to always return `undefined` → both new "stop keeps blocked reason" tests (job-state.test.ts, machine.test.ts) fail as expected; reverted.
- Mutation 2: removed `!job.reason.startsWith(STOPPED)` filter in feature-guard.ts sweep → "sweep leaves a job it stopped already" test fails (emits a duplicate `cap-reached`); reverted.
- Mutation 3: `reachedCap`'s `>=` → `>` for budgetUsd → three tests fail (exact-cap refusal, missing-cost test, two-jobs-crossing test); reverted.
- Mutation 4: missing/broken-cost fallback changed from `Infinity` to `0` → "cost file is missing counts as its whole budget" test fails; reverted.
- `git status --short`: clean after each mutation restore.

PASS
