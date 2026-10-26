# AR0335 - Review 4

- Job: 2026-10-26-review-30c3114b
- Branch: arthur/2026-10-26-worker-cba914c7
- Commit reviewed: ce8897a3f165ce25d732a6a16f629125003b0482
- Verdict: PASS

## Final message

No blocking findings. Both round-3 points are fixed. The AR-D51 decision (2026-10-26) asked for `--end-of-options` to count like `--` for `worktree add`/`move` targets, plus an inside-target add run from an outside folder. Both are there and tested. The range does everything the Done means list asks: `gc`, `prune`, `repack`, `reflog expire`/`delete`/`drop`, `maintenance`, `filter-repo` and `worktree prune` are refused, and so is a `worktree add`/`move` whose target lies outside the worktrees folder. Each refusal names the main checkout. `git reflog show` and `git worktree list` still pass.

**Notes (not blocking)**
- **Option values counted as paths, `packages/core/src/git-writes.ts:72`:** the `adds` filter drops only words that start with `-`. A separate option value, like `-b topic` or `--reason x`, is judged as a target path. Run from an outside folder, `git -C /tmp --git-dir=<own>/.git worktree add -b topic <own>/wt3` is refused, naming the main checkout; I checked this with a throwaway test row. This refuses too much rather than too little, so it opens no hole.
- **Long comment line, `packages/core/src/worktree-guard.ts:70`:** the reflowed comment has one line much longer than the rest. The file is still 200 lines.
- **Worker's claims match what I see:**
  - The fix is at `git-writes.ts:72`, with two new refused rows and one new allowed row (`wt2`).
  - The core budget is 6206: `cat packages/core/src/*.ts | wc -l` gives 6555, and `testing.ts` plus `fake-agent.ts` are 349.
  - The merge's only change of its own is the budget note and number in `test/structure.test.ts`. The range touches 5 files, all on topic.

**Checks run**
- `npm ci`: 22 packages added.
- `npm run check`: `tsc` printed no errors.
- `npm test`: 1150 tests, 1092 pass, 0 fail, 0 cancelled, 58 skipped.
- `node --test packages/core/test/worktree-guard.test.ts` with no changes: 11 pass, 0 fail.
- **Mutations:** each run against the guard test, then restored with `git checkout --`. Every one was caught (fail 1):

  | Mutation | Caught |
  |---|---|
  | Drop `\|\| each === "--end-of-options"` | yes |
  | Drop `each === "--" \|\|` | yes |
  | Replace the filter with `filter(() => true)` | yes (round 3's gap is closed) |
  | `shared` ignores `tunes` | yes |
  | `gc`/`maintenance` regex made case-sensitive | yes |
  | reflog list cut to `["expire"]` | yes |
  | `worktree prune` changed to `"pruneX"` | yes |
  | `["add","move"]` changed to `["add"]` | yes |
  | `configEnv` dropped from `tunes` | yes |
  | Config-write `rest` dropped from `tunes` | yes |
  | `adds` resolved from `cwd` instead of `dir` | yes |
  | `shared` removed from the guard's condition | yes |

- **Bypass probes** (throwaway rows, all refused naming the main checkout, then restored):
  - an alias `-c alias.wa='worktree add --end-of-options' wa -x` run from `/tmp` with `--git-dir`
  - `--end-of-options -- -x`
  - `bash -c 'cd /tmp && git worktree add y'`
  - `git worktree add ~/wt`
  - `worktree move … --end-of-options --end-of-options`
- **Real Git** (2.43.0, scratch repo under `/tmp/ar0335-r4-*`, removed afterwards): `git --git-dir=../r/.git worktree move ../wt --end-of-options -y` ran from an outside folder exits 0 and moves the worktree to `out/-y`. So the new `move` row covers a real hole.
- `git status --short` was empty at the end.

PASS