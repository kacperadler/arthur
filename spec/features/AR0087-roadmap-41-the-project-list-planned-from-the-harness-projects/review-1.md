# AR0087 - Review 1

- Job: 2026-10-17-review-ar0087-project-li-ed62fcaf
- Branch: h/2026-10-17-ar0087-project-list-83287a88
- Commit reviewed: f665cfa8acaf44095e54ba2baa0ae2c4360e04f2
- Verdict: PASS

## Final message

No findings that block merge.

**Notes (non-blocking):**
- `packages/core/src/testing.ts`'s slice cleanup relies on `process.on("exit")` (unchanged by this diff — it's the comment-only edit the worker and plan both call out). The 6 `arthur_test_*.slice` units the worker found were present *before* I ran anything and the count was identical after my own full `npm test` run — this diff's tests create and clean their own slices correctly; the leftovers are residue from unrelated/interrupted prior runs in this shared sandbox, not a regression this branch introduces.
- Worker's disclosed manual smoke (`arthur spawn ... --project blog` against the real `omp`, in the shared `arthur-jobs` slice, $0.0443, then `stopall`) is outside the committed test suite, so it isn't a styleguide violation, but it did touch a production-named resource; good that it was disclosed.
- The two plan-wording deviations the worker flagged (context header's extra clause, doctor `check()` returning a bare `"missing: no about"` string) are minor, match the plan's intent, and don't contradict any ticket Decision.

**Checks run (in this worktree):**
- `npm ci` → ok.
- `npm run check` (tsc) → no errors.
- `npm test` → 329/329 pass, including all new `packages/projects/test/*` and `packages/core/test/spawn.test.ts` cases.
- Mutation testing on key refusals, each restored with `git checkout --`:
  - `clone.ts` origin-mismatch check disabled (`if (url !== repo)` → `if (false)`): caught by "another origin is refused" test.
  - `project-options.ts` cross-key uniqueness check disabled: caught by the duplicate-name/prefix/title test.
  - `install.ts` exit-code refusal disabled (`if (ran.code === 0)` → `if (true)`): caught by the failing-install test.
  - `job-checkout.ts` project lookup forced to always pick the first project: caught by the new `--project` spawn test.
- Grepped the diff for real names/paths/clients (`kacper`, `marketplace`, `north`, `south`, `Acme`, `reviewer`, `qa-board`, `helpdesk`) — only removed (old roadmap) lines match; no added line does. Confirms the worker's own report.
- Verified `arthur.config.ts` is untracked and now in `.gitignore`.
- Verified per-file line caps: `jobs.ts` 194, `testing.ts` 200, `board.ts` 192, `job-checkout.ts` 21, every `packages/projects/src/*.ts` ≤96; `projects` budget set to 320 in `test/structure.test.ts` against ~285 actual source lines.
- Verified plugin boundary: `packages/projects/src/*` imports only Node builtins, `@arthur/core`'s published `describe`, and `@arthur/core/plugin` types — no other plugin, no core file by path; structure-test boundary checks pass.
- Cross-checked the plan's "How to test" list (option refusals, MP three-checkouts case, clone, install, context block, `arthur projects`/`/projects`, doctor) against the actual test files — each point has a matching test.
- Cross-checked `spec/roadmap.md`/`spec/vision.md` diffs against the plan's "Roadmap entries that change" section (41, 42, new 84, line 14, 25, 44, 80, Settings row) — all present and worded as specified.
- `git status --porcelain` clean after all mutation checks were reverted.

PASS
