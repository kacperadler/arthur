# AR0092 - Review 1

- Job: 2026-10-17-review-ar0092-5fca353c
- Branch: h/2026-10-17-ar0092-c3f72abb
- Commit reviewed: c4f3b215c301aad6fc24f2dc15fb07c3a40a94d7
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

---

**Findings:** none blocking.

**Notes (non-blocking):**
- `job-place.ts` (new) isn't matched by any keyword in `arthur.config.example.ts`'s `review.alwaysReview` list (`policy, hooks, merge, stop, deploy, bin, secrets, roles, criteria`) — but neither was `worktree-guard.ts` before the split; the move doesn't change its review-list exposure. No enforcement mechanism exists yet (`delivery` plugin unbuilt), so this is purely informational for future list tuning, not a regression from this diff.
- F1 (open, in `spec/features/AR0092.../findings.md`) honestly records the residual gap: a project added to `arthur.config.ts` stays unguarded until some `arthur` command reloads the config (`arthur run`'s daemon doesn't reload). This is consistent with the ticket's Done means (which ties the guard's freshness to the config-load-rewritten file, not to literal real-time file watching) and was pre-flagged in AR0059's own findings pointing at this ticket.
- Core reading `<home>/projects/checkouts` (a fixed path into the projects plugin's folder) is explicitly what the ticket's Done means asks for, and the Focus note sanctions it; the worktree guard runs in a separate OMP-extension process with no access to the host/plugin API, so a file read is the only mechanism available.

**Checks run (in this worktree, on `c4f3b215`, against base `7f16cb506`):**
- `npm ci`: clean, 6 packages added, no lockfile change.
- `npm run check` (tsc): clean, no errors.
- `npm test`: 341/341 pass, 0 fail — matches the worker's claim exactly.
- `git diff --stat` against base: only `packages/core/{src/job-place.ts (new), src/worktree-guard.ts, test/worktree-guard.test.ts, docs/commands/spawn.md}`, `packages/projects/{src/projects.ts, test/projects.test.ts, docs/commands/projects.md}`, and the ticket's own `findings.md` — matches declared Scope (`packages/projects`, `packages/core/src/worktree-guard.ts`, their tests/docs), no stray changes.
- Read `job-place.ts`, `worktree-guard.ts`, `projects.ts` diffs line by line against the worker's description; `Place`/`real`/`jobPlace` moved verbatim (no logic drift), `declaredPlace`/`others` factored out correctly, `keepCheckouts` writes through temp-file+rename and only on changed content.
- Mutation 1 (reproduced worker's claim): replaced `declaredPlace(place, fallback)` with bare `place` in `worktreeGuard` → new test fails (`write()` stays `undefined` after beta declared). Reverted, `git status --short` clean.
- Mutation 2: removed the `if (!said)` guard around `appendFileSync` → new test fails (`2 !== 1` fallback-line count). Reverted.
- Mutation 3: changed `declaredPlace`'s catch branch to `return { ...place, others: [] }` instead of `return place` → new test fails (write passes when it should refuse using the record's list). Reverted.
- Mutation 4: removed `if (kept === text) return;` in `keepCheckouts` → projects test fails (inode changes on a reload with the same list). Reverted.
- All four mutations match exactly what the worker's final message claims it mutation-tested; `git status --short` clean after each revert.
- Boundary check: `packages/core/package.json` exports (`.`, `./clock`, `./env-guard`, `./plugin`, `./testing`) do not include `job-place.ts` — not leaked to plugins. `projects.ts` imports only `@arthur/core/plugin` plus its own package's files — no cross-plugin or core-internal-by-path import.
- Docs: `spawn.md` and `projects.md` diffs read; both describe the new live-read/fallback/said-once behavior accurately, matching the code.

PASS
