# AR0081 - Review 1

- Job: 2026-10-17-review-ar0081-config-che-5cc0f497
- Branch: h/2026-10-17-ar0081-config-check-8fb966b8
- Commit reviewed: d042872f3d1f5083650ce440afcdee7bc47f2845
- Verdict: PASS

## Final message

Worktree clean, commit matches task's cited tip.

---

**Findings:** none.

**Notes:**
- Diff is minimal and exactly matches the ticket's Done means: one `.filter` dedup call in `checkEnv`'s `plugins` pipeline, both named tests updated to drop the prefix line, new test proving the second plugin's bad options are never checked. No scope creep.

**Checks run (in this worktree, not the main checkout):**
- `npm ci`: clean install, 7 packages.
- `npm run check` (`tsc`): no errors.
- `npm test`: 358 tests, 358 pass, 0 fail — matches worker's claim.
- Mutation: removed the `.filter((plugin, index, all) => …)` dedup line from `packages/core/src/env.ts`, reran `node --test packages/core/test/env.test.ts packages/core/test/config-check.test.ts` → 2 failures (the config-check refusal test and the new "a second plugin of a name" env test), confirming both tests actually catch the regression of the fixed behavior, not just incidentally pass. Restored with `git checkout -- packages/core/src/env.ts`; `git status --short` clean afterward.
- CLI smoke test in a throwaway `/tmp/ar0081-smoke` project with `[orchestration, telegram, telegram, a, a-b, x{instance b: Env}, x-b: Env]`: output was exactly one line for the duplicate telegram (`plugins[2]: a second plugin named telegram; the first is plugins[1]`), the `ARTHUR_X_B_` prefix-collision line between `x-b` and instance `b` of `x` still printed (prefix sharing across different plugins/instances stays refused), exit code 1 — matches the worker's claimed run. Temp dir removed afterward.
- Line budgets: `packages/core/src/env.ts` 179 lines (under the 200 budget); no runtime dependency added; no plugin/core boundary touched (only `@arthur/core` internals and its own tests changed).

PASS
