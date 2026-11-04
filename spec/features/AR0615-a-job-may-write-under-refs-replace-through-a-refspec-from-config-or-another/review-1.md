# AR0615 - Review 1

- Job: 2026-11-04-review-8be41091
- Branch: arthur/2026-11-04-worker-0d510c16
- Commit reviewed: 7e2f27c012b2ccc7e6e65fdd45628565cc4a2c97
- Verdict: FAIL

## Final message

The branch keeps `core.useReplaceRefs=false` in each project's shared Git config and the docs say so, but it fails review: one hand mutation of the condition that decides whether to put the setting back survives the tests.

## Findings

1. **`packages/core/src/git-config.ts:51`: whether the setting is put back is only tested with the value `true`.** I changed `value === "false" ? []` to `value !== "true" ? []`, and `packages/core/test/git-config.test.ts` still passes (pass 7, fail 0).
   - The test's four ways of undoing the setting all reach the code as the literal `true`: setting `true`, a key with no value (Git lists it as `true`), `true` in the main checkout's `config.worktree`, and `true` in the shared config, checked from a job's worktree.
   - A job that sets `core.useReplaceRefs` to `yes`, `on`, `1` or `2` makes Git read replacements again. The code as written puts the setting back for every value except `false`, but no test catches that rule being narrowed to `true`.
   - This condition is what the ticket protects, and the review criteria count an uncaught mutation of a key condition as a FAIL.
   - Fix: add rows to the test's `undo` list, for example `git(m, "config", "core.useReplaceRefs", "yes")` and `"1"`.

## Notes
- (risk) `packages/core/src/git-config.ts:36`: the setting is only put back when Arthur runs its config check. Between two checks, a job running at the same time can set it to `true`, or write it into a reviewer worktree's `.git/worktrees/<name>/config.worktree` after that worktree is created. The reviewer's own git commands would then read a replacement. The merge is not exposed: `arthur merge`, `take-main`, `gitOver` and manage's health checks already run git with `--no-replace-objects`. This gap comes with the approach the owner picked (AR-D473); setting `GIT_NO_REPLACE_OBJECTS=1` in each job's environment would close it for reviewers.
- (risk) `packages/core/src/git-config.ts:52`: until the value is `false`, every check writes the config. Two checks at once, or a job holding `config.lock`, then refuse a spawn or merge with "could not lock config file". Once the value is `false` the write is skipped, so this stops.
- (minor) `.git/info/grafts` can also change what Git reads as a commit's parents, without `refs/replace`. It is outside this ticket.
- (minor) The change to the commit-rules test does not hide a regression. Setting the value to `false` beforehand makes the core's write do nothing, so the "config untouched" and `config.lock` tests still see only the plugin's own write.
- (minor) The one `npm run mutate` survivor, at `git-config.ts:47` (`split("\n", 1)` → `split("\n", 2)`), changes nothing: `[0]` is the same either way.
- (minor) The core line budget raise from 7158 to 7163 is covered by policy AR-D63. No file changed size zone.
- (minor) Outside the range: the test runs left processes behind (`sleep 300` and two `fake-agent.ts` runs with `handoff-extension.ts`, under `/tmp/arthur-test-*`). I stopped them by PID.

## Checks (on 7e2f27c0)
- `npm run check`: tsc passed.
- `npm test`: 1536 tests, 1472 pass, 0 fail, 64 skipped.
- `npm run mutate` (default `--max 25`): 25 mutants, 24 caught, 1 survived (the one above that changes nothing), 34 not run.
- Hand mutations, each run against `packages/core/test/git-config.test.ts` and restored with `git checkout --`:
  - Never rewriting once the key is set (`target = []`): caught (fail 1).
  - Writing with `--local` instead of `--file <file>`: caught (fail 1).
  - No refusal when the write fails: caught (fail 1).
  - Rewriting only when the value is `true` (`value !== "true"`): **survived** (fail 0).
- `git status --short` was empty after the restores.

FAIL