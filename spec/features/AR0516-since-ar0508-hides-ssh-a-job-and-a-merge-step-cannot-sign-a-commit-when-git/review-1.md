# AR0516 - Review 1

- Job: 2026-10-27-review-365f8876
- Branch: arthur/2026-10-27-worker-9da5d0ff
- Commit reviewed: 86d4f431e9f107bc5edb9d03faa56e24d7641dd8
- Verdict: PASS

## Final message

No findings block the merge. Jobs, their installs and merge steps now commit and tag unsigned without a flag, and Arthur's merge commit stays signed, as Decision AR-D184 requires. `npm ci` and `npm run check` pass; `npm test` passes only with the same signing-off variables the worker used (below).

**Findings**

None.

**Notes (do not block the merge)**

- **Line budget**: `packages/core/src/job-sandbox.ts:106,108`. `cached` was rewritten as a single-line arrow function, and the new `unsigned` is also one line (roughly 400 characters each), to stay within core's line budget of 6345 rather than record a raise. The final message says so openly, and other single-line calls are as long (`wrapper.ts:123`). The real cost is about 2 lines over budget that the budget test no longer sees.
- **`unsigned` signature**: `unsigned(env, given = …)` uses a default parameter as a local variable, so the exported signature gains an optional second argument that no caller uses. This is a matter of taste.
- **Malformed `GIT_CONFIG_COUNT`**: a value Arthur inherits that Git would reject (`abc`) is silently replaced by `2`. Git would have refused that environment anyway, so this is an edge case, not a regression.
- **`tag.forceSignAnnotated` claim**: the worker's test for it used `git tag -a`, and `-a` overrides that setting. I checked the case `-a` skips: `git tag t -m x` with `forceSignAnnotated=true` also exits 0 and creates an unsigned tag, with or without the fix. Git prints a stray `Couldn't load public key` line, but nothing breaks.
- **Not seen in a real job**: "tests pass inside a job and in a merge's `npm test` step" is shown only by setting the same variables by hand; no real job has run on this fix yet.
- **Commit scope**: the commit is scoped `fix(core): … (AR0516)`, not with the ticket id as scope. The final message gives the hook's regex as the reason.
- **Env guard**: it refused a bash `sed` call whose pattern contained `process\.env`, treating it as a secrets file name. I hit this too; it is outside this range.

**Checks run**

- **`npm ci`**: 22 packages installed.
- **`npm run check`**: `tsc` clean.
- **`npm test`, plain**: interrupted at my 1200 s timeout. `packages/models/test/models.test.ts` hung; run alone it gives 3 fail and 1 cancelled, with `Couldn't load public key /home/kacper/.ssh/vps_signing.pub`. This review job is itself sandboxed with signing on, which is the bug this ticket fixes, not this branch.
- **`npm test` with the job variables**: run as `env GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=commit.gpgSign GIT_CONFIG_VALUE_0=false GIT_CONFIG_KEY_1=tag.gpgSign GIT_CONFIG_VALUE_1=false npm test`. Result: tests 1209, pass 1148, fail 0, skipped 61. This matches the worker's numbers exactly.
- **AR0516 test before the fix**: with `job-sandbox.ts` and `wrapper.ts` reverted to the base commit, it fails (ENOENT on `agent-err`, because the install failed). It passes at the commit under review.
- **Mutations**: each was applied, run against the AR0516 test, and restored with `git checkout`. Every one makes the test fail:

  | # | Mutation | Test |
  |---|---|---|
  | M1 | existing `GIT_CONFIG_COUNT` ignored (`given = 0`) | fail |
  | M2 | count `given + 2` changed to `given + 1` (tag entry dropped) | fail |
  | M3 | `...unsigned(process.env)` removed from the wrapper's agent env | fail |
  | M4 | wrapper spread order swapped (`process.env` after `unsigned`) | fail |
  | M5 | `unsigned` entries removed from `cached` (install and merge step) | fail |
  | M6 | `tag.gpgSign` value set to `"true"` | fail |
  | M7 | `cached` writes the entries into Arthur's own `process.env` | fail: `actual [0,false]`, `expected [128,true]` |

  M7 is the case where signing would leak off for the merge commit too. The working tree was clean afterwards (`git status --short` empty).
- **Boundaries**: no plugin imports and no new files; `job-sandbox.ts` is 142 lines, and the structure test passed in the full run. The test uses only temporary folders and restores every environment variable it sets through `t.after`.

PASS