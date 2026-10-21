# AR0241 - Review 1

- Job: 2026-10-21-review-ar0241-merge-uses-ceea03e8
- Branch: h/2026-10-21-ar0241-merge-uses-projec-343c716f
- Commit reviewed: 5c3cfc6869fdc90d1f1204f2656c6b19603230de
- Verdict: PASS

## Final message

Checks run (in this worktree, `6bff3dc0..5c3cfc68`):
- `npm ci` — clean install, 20 packages, no errors.
- `npm run check` (tsc) — no errors.
- `npm test` — 864/864 pass, 0 fail (matches worker's claim exactly).
- `node --test test/structure.test.ts` — 15/15 pass; `wc -l` confirms projects=486, delivery=770 lines of `src/`, matching the claimed budget numbers and the structure test's `BUDGETS`.
- `wc -l` on touched files: `projects.ts` 123, `merge-checks.ts` 64, `merge-command.ts` 109 — all well under the 200-line file cap.
- Mutation 1 (merge ignores `projects.install`, hardcodes `bun install --frozen-lockfile`): `node --test packages/delivery/test/merge.test.ts` → fails ("the install is the project's own..." test), reverted.
- Mutation 2 (reinstall's `install` guard removed, always reinstalls): same test file → fails ("nothing ran, so nothing is reinstalled" assertion breaks), reverted.
- Mutation 3 (unknown-project throw in `projects.install` replaced with `return ""`): `node --test packages/projects/test/install.test.ts` → fails ("Missing expected exception"), reverted.
- `git status --short` after each revert — clean; final tree matches the reviewed commit exactly.

Diff review:
- `merge-checks.ts`/`merge-command.ts`: lockfile table fully removed (no stale references); `mainChecks` asks `install("HEAD")` (post-merge commit), a throw becomes a failed `install` step without running, triggering the existing reset path; `reinstall` only re-runs when the earlier `installed()` actually ran (`step.install === true`), and re-asks `install("HEAD")` which now resolves against the post-reset HEAD (confirmed via test's `mergeCommit`/`before` assertions on `installs`).
- `projects.ts`: `projects.install` reuses the existing, unmodified `installCommand` from `install.ts` — correct reuse, no duplication; throws `no project ${project}` for an unlisted project, propagates `installCommand`'s own two-lockfile throw.
- Docs: `plugin-api.md` "Changes since entry 51" entry and "Provided names" row added; `merge.md` and `projects.md` rewritten to match the new behavior exactly (no leftover lockfile-table language found by grep).
- Tests: new coverage for own/none/lockfile/older-commit/two-lockfiles/unknown-project in `projects`, and custom/none/throw plus request-shape (`{project, commit:"HEAD"}`) and HEAD-at-call-time assertions in `delivery` — edge cases, not just happy path.
- Boundary: delivery reaches projects only via `host.call`, the core's published API — no plugin-to-plugin import.
- Ticket's accepted Decision explicitly covers "install runs on every merge now, not only on a changed lockfile" — matches the one behavior change beyond strict scope that the worker flagged.

Note (non-blocking): the projects line-budget raise (481→486) has an inline comment in `test/structure.test.ts` but no corresponding Decision entry in the ticket, which the styleguide calls for; worker explicitly disclosed this rather than hiding it, and in this project's observed workflow such Decisions are typically appended by the coordinator in a later `chore(board)` commit, not by the fixing worker.

PASS
