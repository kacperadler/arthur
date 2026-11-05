# AR0624 - Review 1

- Job: 2026-11-05-review-a608942d
- Branch: arthur/2026-11-05-worker-e5e58c0b
- Commit reviewed: 9d1f573d9109df1bb76e497275d7ec57d3cd2557
- Verdict: PASS

## Final message

The branch does what the ticket asks. The worktree guard now refuses `git fast-import --allow-unsafe-features` on any repository, the new test rows fail when the refusal is removed, and both checks pass on `9d1f573d`. No finding blocks the merge.

- `packages/core/src/bash-refusal.ts:131`: the new condition `sub === "fast-import" && rest.includes("--allow-unsafe-features")` matches the flag as an exact word, which is how Git reads it (`strcmp` over argv). I tried other forms of the flag in a throwaway test, removed afterwards. These were all refused:
  - the flag quoted (`"--allow-unsafe-features"`, `--allow-unsafe-feature"s"`, `--allow-unsafe-feature\s`)
  - the command run through `env`, `command`, `sudo`, `bash -c` or `xargs`
  - the flag after `--`
  - the flag inside an alias given by `-c`; a shell alias (`!git …`) is refused as unread config.

  A `--git-dir=` repository was refused by the existing check.
- The ticket's own case, a `printf 'feature export-marks=${main}/marks\n' | …` row, is in `packages/core/test/worktree-guard.test.ts:587`. It fails without the refusal. A plain `git -C /tmp/other fast-import` and one with `--export-marks` outside every project still pass, as they did before.
- `bash-refusal.ts` went from 210 to 211 lines, still yellow. The worker's message says why: one comment line added to a file that was already yellow. The core line budget was not raised, and the structure test passes.
- `docs/deploy.md:44` describes the new refusal. No other doc, README or roadmap line mentions this flag or `export-marks`, so nothing else is out of date.

## Notes
- (security) packages/core/src/bash-refusal.ts:131: the flag set at run time passes. `f=--allow-unsafe-features; git -C /tmp/other fast-import $f` passes, and so does `$(echo git) -C /tmp/other fast-import --allow-unsafe-features`. The base already lets every word built at run time through (`rm $x` and `git -C /tmp/other fast-import --export-marks=$x` pass too), so this is the guard's existing gap, not one the branch opens.
- (security) spec/features/AR0624-git-fast-import-with-allow-unsafe-features-and-a-feature-export-marks-line-on/findings.md: F1 is a real remaining hole. A stdin line `option git export-pack-edges=<path>` needs no `--allow-unsafe-features` and makes `git -C /tmp/other fast-import` append to any file. It is filed as open, outside this ticket.
- (minor) packages/core/src/bash-refusal.ts:131: the refusal says "writes into the main checkout" for a repository outside every project. The existing `--export-marks` refusal says the same, so the wording follows the base.

## Checks (on 9d1f573d)
- `npm run check`: tsc passed with no errors.
- `npm test`: 1550 tests, 1486 pass, 0 fail, 0 cancelled. My first run's filter missed the summary lines, so I ran it a second time to read them.
- `npm run mutate`: no result. The full run hit the 3600-second limit, so I have no survived count. Nothing was left running and the tree was clean afterwards.
- Hand mutation, removing the new condition: `worktree-guard.test.ts` went to 16 pass, 1 fail. I restored the file with `git checkout`.
- Bypass check: a throwaway test with 23 command forms, results as above; the test file was restored.

PASS