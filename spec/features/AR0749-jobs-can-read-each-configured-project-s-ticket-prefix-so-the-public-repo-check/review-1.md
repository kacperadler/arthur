# AR0749 - Review 1

- Job: 2026-11-27-review-e1054cb4
- Branch: arthur/2026-11-27-worker-50c2002d
- Commit reviewed: d175cd243bd59fea2e3c44ba0f3fe92400e9a083
- Verdict: PASS

## Final message

PASS

No findings. All five Done-means points are met by the diff.

- **Done 1:** `packages/projects/src/projects.ts:53-54` writes `checkouts`, `folders` and `prefixes` in one loop through the existing `keep`, which writes a temporary name and renames it. It writes only outside a job. `packages/projects/test/projects.test.ts:103-125` checks the content after the first load and after adding a project, that the inode stays the same on an unchanged reload, that the file is kept after a refused reload, and that the folder holds exactly `checkouts`, `folders` and `prefixes`.
- **Done 2:** `packages/core/src/job-sandbox.ts:116` adds `prefixes` to `shown`. The `hidden()` rows in `packages/core/test/sandbox.test.ts` (362, 375, 403) include it. The real Landlock test (line 832) ran, not skipped: the job reads `prefixes` and still gets "denied" on shop2's `project.config.ts`.
- **Done 3:** the test refuses `"sh"`, `"S1"`, `"S-H"`, `""`, `"SH\nXX"` and `"SH BL"`. Each leaves no file in a fresh home and leaves the earlier good `prefixes` unchanged on a reload.
- **Done 4:** `projects.md`, `spawn.md` ("The sandbox") and `docs/deploy.md` name `<home>/projects/prefixes` and what a job may read.
- **Plan:** the branch follows the approved plan's approach and files. The one wording change, dropping the `(job-place.ts)` aside from the comment, keeps the block at 7 lines; the final message says why. No boundary or Shape rule breaks: there is no new file, `job-sandbox.ts` stays yellow at the line count it had before, and the worker's message explains that.

## Notes
- (risk) packages/core/src/job-sandbox.ts:116: a running job only sees `prefixes` as it was when its run started. If the file was missing then, or `keep` replaced it during the run, the job gets EACCES. AR0744's check must treat an unreadable file as "refuse", not "pass". The plan and the final message both flag this.
- (minor) review scope: on your instruction I read only the branch diff. I did not read the ticket's `findings.md` on the branch, and I did not search other files for older wording about the home lists.

## Checks (on d175cd24)
- `node --import @arthur/core/testing --test packages/projects/test/projects.test.ts packages/core/test/sandbox.test.ts`: tests 52, pass 48, fail 0, skipped 4. The Landlock test (AR0593, AR0749) ran and passed.
- Hand mutation, both source changes at once: I removed `"prefixes"` from `shown` in `job-sandbox.ts:116` and removed `["prefixes", "prefix"]` from the `projects.ts:54` loop. The same two test files then gave fail 11, pass 37. That covered the three `hidden()` home-row tests, the Landlock test and the "each load keeps …" test. I restored both files with `git checkout --`.
- On your instruction I did not run `npm run check`, `npm test` or `npm run mutate`.

PASS