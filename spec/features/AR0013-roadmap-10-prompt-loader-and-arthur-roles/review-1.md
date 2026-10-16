# AR0013 - Review 1

- Job: 2026-10-16-review-ar0013-prompt-loa-ac0c63db
- Branch: h/2026-10-16-ar0013-prompt-loader-and-3b7a4481
- Commit reviewed: cc82c06de8a1e3780fa68c400c3f5b3a23da6dc7
- Verdict: PASS

## Final message

No `dependencies` key or empty — consistent, matches structure test's enforcement (already passing). All checks done.

Findings: none that block merge.

Notes:
- Minor pre-existing `help.md` fix (missing `spawn` in core command list) bundled in; worker's final message discloses it, in-scope per styleguide's small-fix allowance.
- `jobs.ts` sits at 192/200 lines, close to the per-file budget but compliant; `job-record.ts` extraction correctly keeps it under.

Checks run (in this worktree, on commit `cc82c06`):
- `npm ci`: clean, 5 packages added.
- `npm run check`: clean, no tsc errors.
- `npm test`: 163/163 pass.
- Mutation 1 (disable the symlink/escaped-folder check in `projectFile`, `packages/core/src/roles.ts`): 2 tests fail (`a symlinked override or criteria file...`, `arthur roles prints each role...`). Restored; `git status` clean.
- Mutation 2 (call `sections()` before iterating `sources(role, folder)` in `prompt()`, same file — violates "plugin sections asked only after project files pass"): 2 tests fail (`a worker's prompt is its role file...`, `a symlinked override or criteria file...`). Restored; `git status` clean.
- Manually traced `jobs.ts` spawn flow: role lookup (`roles.get`), `roleModel` resolution, and `beforeSpawn` checks all happen before `addWorktree`; prompt/section/record failures after the worktree exists are caught and both worktree and record are removed, matching ticket's Done means and spawn.md's two refusal categories.
- Verified role/criteria name validation (`NAME` regex, lowercase+dashes only) blocks any `../`/absolute-path escape for override and criteria files — no test gap found for this since the regex structurally prevents it.
- Confirmed `arthur roles` output format and error paths (argument, unknown project, config-not-loaded) against `roles.test.ts` and `docs/commands/roles.md` — match.
- Confirmed the two ticket Decisions (roles.model hook shape; symlink refusal + empty-criteria warning) are implemented as decided.
- `git status` clean at finish.

PASS
