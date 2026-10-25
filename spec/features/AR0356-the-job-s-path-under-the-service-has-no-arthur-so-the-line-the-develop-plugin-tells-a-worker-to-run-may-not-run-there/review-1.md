# AR0356 - Review 1

- Job: 2026-10-25-review-9f53a5d9
- Branch: arthur/2026-10-25-worker-1e61e30e
- Commit reviewed: 4ff1cbf252bb861e3702d7a75c0920af923cdd7e
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0356 asks: it takes the ticket's first option, so the worker's line now names the CLI by its path, `cd <checkout> && node_modules/.bin/arthur plugin new …`. Because of the `cd`, that is the same file as `<checkout>/node_modules/.bin/arthur`. `launch` is unchanged.

**Findings**

None.

**Notes (do not block the merge)**

- **Untested hint:** the worker's help hint at `packages/develop/src/plugin-new.ts:129`, `` `node_modules/.bin/arthur plugin --help` ``, has no test. I put it back to `` `arthur plugin --help` `` and `plugin-new.test.ts` still passed 5/5. This does not fail the branch: the ticket covers only the fenced line, and the old test did not check the hint either.
- **Test PATH matches setup:** the test's `PATH` is the same as the `printf` at `docs/setup.md:148`: Node's bin, `~/.local/bin` (a temporary one in the test), `/usr/local/bin`, `/usr/bin`, `/bin`. The guard `command -v arthur` fails first, so the test can't pass just because `arthur` happens to be on the machine's `PATH`.
- **Other-folder runs still fail as they should:** the runs from the worktree and from the bare repository now go through `elsewhere()`. If its `replace` stopped matching, the line would exit 0, not 2, and the test would fail.
- **Guard test:** the change at `packages/core/test/worktree-guard.test.ts:602` only follows the new line, and the guard still lets it through.
- **Flaky test outside this branch:** one run of the full suite failed `packages/core/test/job-state.test.ts:142` with `ENOENT` on `…/active`. That file is not in the range. Run alone it passed 14/14, and a second full run passed.

**Checks run**

- `npm ci`: added 22 packages.
- `npm run check`: `tsc` reported no errors.
- `npm test`:
  - First run: exit 1; my `grep` for the summary matched nothing, so I have no counts.
  - Second run: one failure in `job-state.test.ts:142` (the flaky test above).
  - Third run: exit 0, 1108 tests, 1050 pass, 0 fail.
- `node --test test/job-state.test.ts` (in `packages/core`): 14 pass, 0 fail.
- Mutation: bare `arthur plugin new` put back in the source and in the test's expected line. `plugin-new.test.ts` failed with `sh: 1: arthur: not found`, so the test catches it. Restored with `git checkout --`.
- Mutation: help hint put back to `arthur plugin --help`. Not caught (see notes). Restored.
- `git status --short` after the restores: clean.
- The worker's claims match what I found: 4 files changed, a net-zero source diff, one commit `4ff1cbf2 fix(AR0356): …`, and the guard test still passes.

PASS