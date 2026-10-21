# AR0260 - Review 1

- Job: 2026-10-21-review-ar0260-plugin-new-3ea24b6a
- Branch: h/2026-10-21-ar0260-plugin-new-in-a-w-1a01c2ba
- Commit reviewed: 4b192b49a2d0973cb64806db1a42c60ee748431c
- Verdict: PASS

## Final message

Clean working tree, no leftover mutations.

---

**Findings:** none that block merge.

**Notes (non-blocking):**
- `packages/develop/src/plugin-new.ts:49` `target()` ignores the `checkout` argument entirely once `ARTHUR_JOB` is set, so a job's `--project` choice has no effect on where the package lands (always the job's one worktree). This matches the worker's stated/accepted pick ("`--project` then picks no folder") and the ticket's Decision ("Coordinator (free hand) accepted the worker pick"), so it's in scope, not a defect.
- F1 (new finding) correctly left `Status: open`, generic, no real client/project names — fine per the leak rule.

**Checks run (in this worktree, not the main checkout):**
- `npm ci`: clean, 22 packages.
- `npm run check` (tsc): clean, no errors.
- `npm test`: 947 tests, 947 pass, 0 fail, 0 cancelled — matches the worker's claimed numbers exactly.
- `node --import @arthur/core/testing --test packages/develop/test/plugin-new.test.ts`: 3/3 pass.
- Mutation 1 — made `target()` accept *any* `--root` as the job's worktree (dropped the `realpathSync` comparison): the job-worktree test fails as expected (`code 0` where `code 1` "is not this job's worktree" was expected). Restored via `git checkout --`.
- Mutation 2 — made `target()` ignore `ARTHUR_JOB` (`record = undefined`): the job-worktree test fails as expected (`code 0` where `code 1` "add --root" was expected). Restored via `git checkout --`.
- Verified the symlink-to-worktree case is exercised in the test (`link` test case) and passes with real code; confirmed `realpathSync` resolves it, matching the Focus's "symlink resolved" requirement.
- Verified `temporaryFolder()` (used by the new test) is `mkdtempSync`-based, never a fixed/production path; no production resource names anywhere in the diff.
- Confirmed the new `target()` does not import any core file by path (no `jobPlace` from `job-place.ts`, which is a plugin-boundary violation since it's not in `@arthur/core`'s published `exports`); it reads `ARTHUR_JOB`/`<record>/worktree` directly, consistent with how other plugins (`youtrack-command.ts`, delivery's `checks-extension.ts`) already do.
- Line-budget raise (198→209, +11) matches the stated `+19/−8` diff on `plugin-new.ts` (net +11); comment above `BUDGETS` in `test/structure.test.ts` names the reason, following the file's existing convention.
- Docs (`plugin.md`, `develop.md`, `README.md`) updated consistently with the new `--root`/job behavior; `readme.test.ts` passed in the full suite, confirming the README line stays in sync.
- Commits are Conventional Commits scoped `(AR0260)`, matching ticket id.

All Focus checklist items verified: in-job accepts only `--root` equal to the worktree (symlink resolved); any other folder, a missing one, or no `--root` refused before any write; outside a job `--root` is refused and prior behavior is unchanged; tests use temp folders only; the worker's "free hand" pick is covered by the ticket's Decisions.

PASS
