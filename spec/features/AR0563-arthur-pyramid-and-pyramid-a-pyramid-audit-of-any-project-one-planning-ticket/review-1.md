# AR0563 - Review 1

- Job: 2026-11-07-review-db049a2f
- Branch: arthur/2026-11-07-worker-0af70689
- Commit reviewed: 8e96573c8a19b638aeed15ca97cd04d02f454d08
- Verdict: FAIL

## Final message

## Findings

1. **`packages/manage/src/pyramid.ts:105`: the "no Arthur history" check is tested only at its two extremes.** One test has every input empty and the other has every input present, so dropping any single input from the check goes unnoticed:
   - `ledger[3]` (blocked questions) dropped from `[ledger[0], ledger[1], ledger[3]]`: 5/5 pass.
   - `ledger[0]` (FAIL reviews) dropped: 5/5 pass.
   - `&& ledger[4]?.endsWith("\n\nnone")` (steers) removed: 5/5 pass.

   With any of these mutants, a project whose only history is steers, or only blocked questions, or only FAILs gets "No Arthur history … read its git log instead". That is the with/without-history distinction the Done means ask a test for. Missing tests: a project that has only steers, one with only a blocked question, and one with only a FAIL review, each asserting that the line is absent.

2. **`packages/manage/src/pyramid.ts:98`: "Blocked on the owner" has no test that would fail if its filters were removed.** The Done means say "blocked-on-user questions" of this project, but the test has a single job that is both in acme and blocked on `user:`:
   - `&& each.reason.startsWith("user: ")` removed: 5/5 pass. Jobs blocked on a budget or feature cap then appear as owner questions, with their reason cut at a wrong offset.
   - `each.project === job.project &&` removed: 5/5 pass. Other projects' blocked jobs leak into this project's ledger.

   Missing test: a job blocked for a non-user reason, and a user-blocked job in another project, both absent from the section.

## Notes
- (risk) packages/manage/src/pyramid.ts:94: plan reviews count as FAIL reviews. `*review-*.md` also matches `plan-review-N.md`, while docs/manage.md says "a `review-N.md` holding `- Verdict: FAIL`".
- (minor) packages/manage/src/report-file.ts:125: `/repeats` page title. With no `# ` line its title is now empty; the old renderer used `Repeats`. Harmless today, since the digest always has a title.
- (minor) packages/manage/test/pyramid.test.ts:128: noisy test output. The test emits `job-started` without `tickets`, so each run prints `plugin core: handler of job-started … failed` three times.
- (minor) packages/manage/src/pyramid.ts:95: the not-on-board filter is not really covered. It is only held by tsc and a crash; the `doesNotMatch(/AC0099/)` assertion would not catch a listed off-board ticket, which would print as `undefined`.
- (minor) The line budget raise is justified. The report-style before/after page the ticket requires costs about +75 over the +105 estimate. It reuses the `/repeats` renderer instead of copying it, and no manage file is yellow (structure test output).

## Mutate survivors (the worker's run)
I checked the worker's explanations and accept them:
- **Example config (4 mutants):** no test reads it.
- **`manage-options.ts:22`:** only the wording of the summary changes.
- **`repeats-command.ts:15` and `:59`:** reverting them only brings back dead code.
- **`audit.ts` `"--"` and `"."`:** git treats a pathspec with only `:(exclude)` entries as including `.`. Both elements were there before this branch.

Its run tried only 25 of 405 mutants (`--max 25`), so pyramid.ts was covered by my hand mutations above.

## Checks run on 8e96573c
- `node --import @arthur/core/testing --test test/pyramid.test.ts` (packages/manage): 5 pass, 0 fail.
- Hand mutations of pyramid.ts, each restored with `git checkout`; `git status --short` was clean afterwards:
  - **Caught (1 fail each):** project filter in the busy check, `running.has` in the busy check, `deferred` in the findings status, kind filter in the busy check.
  - **Survived (5/5 pass each):** M4 `user:` filter, M5 steers in the history check, M8 blocked project filter, M9 blocked questions in the history check, M10 FAIL reviews in the history check.
- `test/structure.test.ts`, `test/outside-text.test.ts`, `test/arthur-criteria.test.ts` (root): 25 pass, 0 fail; no manage file yellow.
- `audit`, `retro`, `manage-options` and `repeats*` test files (packages/manage): 35 pass, 0 fail.
- Not run, as instructed: the full `npm run check && npm test` and `npm run mutate`.

FAIL