# AR0253 - Review 1

- Job: 2026-10-21-review-ar0253-roadmap-59-cde18210
- Branch: h/2026-10-21-ar0253-roadmap-59-auto-m-df78fc6b
- Commit reviewed: 0d45a405dc7a9138adc42955878de6391f6b8aea
- Verdict: PASS

## Final message

## Review: AR0253 — roadmap 59, auto-merge after PASS and green CI

### Findings (non-blocking)

1. **`packages/delivery/src/delivery-options.ts` `ALWAYS_REVIEW` list doesn't cover the new auto-merge/CI-trust files.** Verified with `node:path`'s `matchesGlob`: `"**/ci-*.ts"` matches `ci-wait.ts` but **not** `github-ci.ts` (basename doesn't start with `ci-`), and none of the four globs match `auto-merge.ts` or `merge-command.ts`. The option's own comment claims the list "covers... the CI-failure handling (entries 57 to 59)," but the files that actually implement entry 59's trust decision (what counts as CI-passed, what counts as a held path) aren't on it. A small future change to any of these files could slip past `review-needed`'s size/doc heuristics and go straight to `done` with no human review. This predates AR0253 for `github-ci.ts` (entries 57/58 already had the gap) and isn't listed as a Done-means item for this ticket, so it doesn't fail the ticket, but it's exactly the risk the review Focus flagged and it's real.
2. **Process hygiene, not code**: the worker's final message discloses it ran `pkill -f "packages/delivery/test/review.test.ts"` while fixing the hang, which could have killed another job's concurrent `npm test` (seen via `ps` at the time). This is outside the diff and not a reason to fail the branch, but the owner should check whether another job's run was affected around that time.

### Verification performed

- `npm ci`, `npm run check`: pass (tsc clean).
- `npm test` (full suite, in this worktree): **887/887 pass**, matches worker's claim exactly.
- Line budgets: `wc -l` on every touched source file confirms `delivery` = 1231 (212 more, exactly accounted for: `auto-merge.ts` 69 + `ci-wait.ts` 120 + `delivery.ts` +13 net + `merge-command.ts` +10 net = 212), `github` = 612 (26 more: `github.ts` +7, `github-ci.ts` +17, `github-api.ts` +2 = 26). Matches `test/structure.test.ts`'s `BUDGETS` and its comment precisely.
- All new/touched source files ≤200 lines (max 162). No classes/enums/runtime deps introduced (`npm run check`'s structure tests already enforce and pass).
- **Mutation testing** on `packages/delivery/test/auto-merge.test.ts` (6 tests), each restored after with `git checkout`/backup-restore:
  - Inverted `autoMerge !== true` → not caught silently; test failed as expected (merge went through when it shouldn't have).
  - Disabled the PASS-on-tip refusal (`if (false)`) → caught, test failed.
  - Disabled the held-path refusal → caught, test failed.
  - Removed the "ran on main" (`run.below >= own`) exclusion → caught, test failed.
  - Disabled the 30-minute hang-cancel condition → caught, test failed.
  - Removed the "told once" dedup on CI-ended wake → caught, test failed (double wake detected).
  - All six mutations were caught by the existing test suite; no blind spot found in the core refusal/wait logic.
- Confirmed `host.folder` is delivery's own per-plugin folder (per `packages/core/src/plugin.ts:62`), so `ci-wait`/`ci-told` files don't cross a plugin boundary.
- Confirmed `github.ci`/`github.cancel` are reached only via `host.call`/`host.provide` (no plugin-to-plugin import); no `@arthur/core` `Host` interface member changed (diff touches no `packages/core` file).
- Confirmed the `.unref()` fix on `ci-wait.ts`'s poll timer is why `review.test.ts` (which calls `plugin.start?.()` without `stop()` in at least one test, line 276) no longer hangs — this ran clean in the full suite.
- Confirmed scope: every touched file outside the ticket's literal Scope list (`packages/github/*`, `docs/plugin-api.md`) is covered by the Decision already recorded in `spec/features/AR0253.../ticket.md` on `main` ("Coordinator (free hand) accepted the github package reach..."), read via `git show main:...`.
- Confirmed commits are signed off and Conventional-Commits-scoped (`feat(AR0253)`, `docs(AR0253)`).

No FAIL-level issue found: no missing/stubbed Done-means item, no boundary violation, no uncaught mutation of a key behavior, checks and tests reproduce exactly as claimed.

PASS
