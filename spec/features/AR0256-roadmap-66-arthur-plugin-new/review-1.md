# AR0256 - Review 1

- Job: 2026-10-21-review-ar0256-roadmap-66-80e77d98
- Branch: h/2026-10-21-ar0256-roadmap-66-plugin-18c71d6b
- Commit reviewed: c8fecd9e469649da6c355fa9a60adbaf8c82078c
- Verdict: PASS

## Final message

Worktree clean, all mutations restored.

**Findings:** none that block merge.

**Notes (non-blocking):**
- F1 (found and filed by the worker in `spec/features/AR0256-roadmap-66-arthur-plugin-new/findings.md`, status `open`): `arthur plugin new` can't run inside a job's worktree since `arthur.config.ts` is gitignored there. Correctly out of scope for this ticket; left as a finding per process, which `h merge` will convert to a ticket.
- `test/structure.test.ts`'s multi-line `// AR0256 …` comment block spans 4 lines above `BUDGETS`; matches the repo's existing convention of wrapped `//` comments (seen elsewhere, e.g. `plugin-new.ts` header), not a deviation.

**Checks run (in this worktree, on commit `c8fecd9`):**
- `npm ci`: clean install, 21 packages added, no lockfile drift.
- `npm run check`: `tsc`, exit 0, no output.
- `npm test`: 883/883 pass, 0 fail — matches worker's claim exactly.
- Read ticket `spec/features/AR0256-roadmap-66-arthur-plugin-new/ticket.md` and roadmap entry 66 at `main`; diff satisfies every Done-means point: refusals for existing name, non-lowercase/dash name, missing/non-positive-whole budget, each proven to leave the repo untouched (`git status` clean) in `packages/develop/test/plugin-new.test.ts`; new package passes `npm run check`/`npm test`/structure test unedited; structure test still refuses a budget-less package (exercised via the "stray" package sub-case); tests run only in a Git-tracked temp copy (`REPOSITORY` → `copy()`), never touching the real checkout — confirmed by reading the test file in full.
- Mutation testing on `packages/develop/src/plugin-new.ts` (edited then `git checkout --` restored each time, confirmed clean):
  - Disabled the "`--budget` below new `src/` lines" refusal → test failed as expected (accepted worker addition, properly covered).
  - Disabled the reserved/clashing function-name refusal → test failed as expected.
  - Disabled the "existing `packages/<name>`" refusal → test failed as expected.
  - Disabled the `@arthur/<name>` symlink write → test failed (`ENOENT` on `readlinkSync`), confirming the test actually checks the link, not just a log line.
  - Bypassed `locked()` so the lockfile workspace entry is skipped → test failed, confirming the `git status` assertion actually checks `package-lock.json` changed.
- Verified `develop`'s line budget: `wc -l packages/develop/src/*.ts` = 198, matches the recorded comment and the worker's claim (107+58+18+15).
- Verified no core/`docs/plugin-api.md` change needed: `host.board.projects()` used by `pluginCommand` is already published (checked `docs/plugin-api.md` line 74); diff touches no file in `packages/core`.
- Verified shape rules: no `dependencies` in `packages/develop/package.json`, no `index.ts`/`types.ts`/`utils.ts`, no class/enum, each new file well under 200 lines, English only, no secrets, nothing listening on a network address.
- Verified commit signoffs: `git log --format='%B'` on all three commits in range shows `Signed-off-by: Kacper (agent) <kontakt@kacperadler.pl>`.
- Verified README/`arthur.mmd` changes: develop moved from `planned` to `partial`, table row shows "1 of 3 entries" / "66 built; 67, 68", mermaid class list updated; both files already covered by the passing `npm test` run ("the README's mermaid block is arthur.mmd, unchanged" and the README status-line test both passed).

PASS
