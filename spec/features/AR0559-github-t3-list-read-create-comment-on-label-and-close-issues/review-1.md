# AR0559 - Review 1

- Job: 2026-11-06-review-3db1659c
- Branch: arthur/2026-11-06-worker-a6441359
- Commit reviewed: e744231b455121e9cfcc398849c88b011be87cfd
- Verdict: PASS

## Final message

No findings. The branch does everything the ticket and plan ask, and both recorded Decisions cover what the worker flagged: the github budget going from 1200 to 1288 (AR-D511) and `issue label` refusing a pull request number (AR-D512).

## Notes
- (minor) `packages/github/src/github-issue.ts:39`: one long line holds the pull request refusal, with nested template strings for three verb cases. The width counting in `test/structure.test.ts` passes, but the line is hard to read.
- (minor) `packages/github/src/github-issue.ts:46`: the "already has the label" check compares in any case against the label name typed, not the matched repository name. The result is the same, because both comparisons ignore case.

## Checks (on `e744231b`, detached checkout)
- **`npm run check`:** tsc passed, no errors.
- **`npm test`:** 1582 tests, 1518 pass, 0 fail, 64 skipped, exit 0. The structure test passes, and no file this branch touches shows up as yellow.
- **`node --import @arthur/core/testing --test packages/github/test/github-issue.test.ts`:** 8 pass, 0 fail.
- **`npm run mutate`:** not run, to keep within the owner's small budget. The worker's one survivor is a comment line, `arthur.config.example.ts:323`, with no behaviour behind it.
- **Hand mutations of the key behaviours:** I ran `github-issue.test.ts` after each one and restored each file with `git checkout`; `git status` was clean afterwards. All 11 were caught:
  - pull request filter in `list` removed: 3 fail
  - "already has the label" refusal disabled: 1 fail
  - "closed already" refusal disabled: 1 fail
  - the typed name sent instead of the repository's spelling: 1 fail
  - pull request number refusal disabled: 4 fail
  - unknown label refusal disabled: 1 fail
  - the 10-page cut line dropped: 1 fail
  - `state_reason: "completed"` dropped: 1 fail
  - the "already has the label" check made case-sensitive: 1 fail
  - the empty-list message disabled: 3 fail
  - `label` added to `READS`, so the job refusal is bypassed: 1 fail
- **Search for stale wording:** docs, README, roadmap and the example config have no line left saying issues are still to come.

PASS